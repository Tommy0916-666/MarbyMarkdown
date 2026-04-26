import { useStorage } from "@vueuse/core";
import { computed } from "vue";

export type AIProvider = "openai" | "anthropic" | "gemini" | "ollama" | "custom";

// 基础 API 配置 - 兼容旧版 AIConfig
export interface AIBaseConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

// 旧版兼容类型
export interface AIConfig extends AIBaseConfig {
  enabled?: boolean;
  debounceWait?: number;
}

// 独立功能配置
export interface AIFunctionConfig extends AIBaseConfig {
  enabled: boolean;
  useIndependentConfig: boolean;
}

// AI 续写模式
export type AIContinueMode = "auto" | "manual";

// AI 续写专属配置
export interface AIContinueConfig extends AIFunctionConfig {
  debounceWait: number;
  mode: AIContinueMode;
  shortcutKey: string;
}

// AI 聊天专属配置
export interface AIChatConfig extends AIFunctionConfig {
  enableContext: boolean;
}

// AI 优化风格预设
export type AIOptimizeStyle = "formal" | "casual" | "concise" | "custom";

// AI 优化专属配置
export interface AIOptimizeConfig extends AIFunctionConfig {
  stylePreset: AIOptimizeStyle;
  customPrompt: string;
}

// 完整的 AI 配置结构
export interface AIFullConfig {
  global: AIBaseConfig;
  continue: AIContinueConfig;
  chat: AIChatConfig;
  optimize: AIOptimizeConfig;
}

// 默认的基础配置
const defaultBaseConfig: AIBaseConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
};

// 默认的完整配置
const defaultAIFullConfig: AIFullConfig = {
  global: { ...defaultBaseConfig },
  continue: {
    ...defaultBaseConfig,
    enabled: false,
    useIndependentConfig: false,
    debounceWait: 2000,
    mode: "auto",
    shortcutKey: "Mod-Shift-Enter",
  },
  chat: {
    ...defaultBaseConfig,
    enabled: false,
    useIndependentConfig: false,
    enableContext: true,
  },
  optimize: {
    ...defaultBaseConfig,
    enabled: false,
    useIndependentConfig: false,
    stylePreset: "concise",
    customPrompt: "",
  },
};

// Default URLs for providers
export const providerDefaultUrls: Record<AIProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  ollama: "http://localhost:11434",
  custom: "",
};

const fullConfig = useStorage<AIFullConfig>("marbymarkdown-ai-config-v2", defaultAIFullConfig, localStorage, {
  mergeDefaults: true,
});

// 获取某个功能实际使用的配置（考虑继承全局）
function getEffectiveFunctionConfig<T extends AIFunctionConfig>(functionConfig: T, globalConfig: AIBaseConfig): AIBaseConfig & Omit<T, keyof AIFunctionConfig> {
  if (functionConfig.useIndependentConfig) {
    return { ...functionConfig };
  }
  // 只保留 functionConfig 里非 baseConfig 的字段，这样 globalConfig 不会被覆盖
  const { provider, baseUrl, apiKey, model, temperature, ...rest } = functionConfig;
  return {
    ...globalConfig,
    ...rest,
  };
}

export function useAIConfig() {
  // 全局配置
  const globalConfig = computed(() => fullConfig.value.global);
  
  // 续写配置
  const continueConfig = computed(() => fullConfig.value.continue);
  const continueEffectiveConfig = computed(() => getEffectiveFunctionConfig(fullConfig.value.continue, fullConfig.value.global));
  const isContinueEnabled = computed(() => fullConfig.value.continue.enabled);
  
  // 聊天配置
  const chatConfig = computed(() => fullConfig.value.chat);
  const chatEffectiveConfig = computed(() => getEffectiveFunctionConfig(fullConfig.value.chat, fullConfig.value.global));
  const isChatEnabled = computed(() => fullConfig.value.chat.enabled);
  
  // 优化配置
  const optimizeConfig = computed(() => fullConfig.value.optimize);
  const optimizeEffectiveConfig = computed(() => getEffectiveFunctionConfig(fullConfig.value.optimize, fullConfig.value.global));
  const isOptimizeEnabled = computed(() => fullConfig.value.optimize.enabled);

  // 更新全局配置
  const updateGlobalConfig = (updates: Partial<AIBaseConfig>) => {
    fullConfig.value.global = { ...fullConfig.value.global, ...updates };
  };

  // 更新续写配置
  const updateContinueConfig = (updates: Partial<AIContinueConfig>) => {
    fullConfig.value.continue = { ...fullConfig.value.continue, ...updates };
  };

  // 更新聊天配置
  const updateChatConfig = (updates: Partial<AIChatConfig>) => {
    fullConfig.value.chat = { ...fullConfig.value.chat, ...updates };
  };

  // 更新优化配置
  const updateOptimizeConfig = (updates: Partial<AIOptimizeConfig>) => {
    fullConfig.value.optimize = { ...fullConfig.value.optimize, ...updates };
  };

  // 重置配置
  const resetGlobalToDefault = () => {
    fullConfig.value.global = { ...defaultBaseConfig };
  };

  const resetContinueToDefault = () => {
    fullConfig.value.continue = { ...defaultAIFullConfig.continue };
  };

  const resetChatToDefault = () => {
    fullConfig.value.chat = { ...defaultAIFullConfig.chat };
  };

  const resetOptimizeToDefault = () => {
    fullConfig.value.optimize = { ...defaultAIFullConfig.optimize };
  };

  const resetAllToDefault = () => {
    fullConfig.value = { ...defaultAIFullConfig };
  };

  return {
    fullConfig,
    globalConfig,
    continueConfig,
    continueEffectiveConfig,
    isContinueEnabled,
    chatConfig,
    chatEffectiveConfig,
    isChatEnabled,
    optimizeConfig,
    optimizeEffectiveConfig,
    isOptimizeEnabled,
    updateGlobalConfig,
    updateContinueConfig,
    updateChatConfig,
    updateOptimizeConfig,
    resetGlobalToDefault,
    resetContinueToDefault,
    resetChatToDefault,
    resetOptimizeToDefault,
    resetAllToDefault,
    providerDefaultUrls,
  };
}
