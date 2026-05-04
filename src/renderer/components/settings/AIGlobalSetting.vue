<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useAIConfig } from "@/renderer/hooks/useAIConfig";
import { AIService } from "@/renderer/services/ai";
import toast from "autotoast.js";

import { Slider } from "@renderer/components/ui/slider";
import Input from "@renderer/components/ui/input/Input.vue";
import Selector from "@renderer/components/ui/selector/Selector.vue";
import AppIcon from "@renderer/components/ui/AppIcon.vue";

const { globalConfig, updateGlobalConfig, providerDefaultUrls: urls } = useAIConfig();

const testing = ref(false);
const testResult = ref<string>("");
const ollamaModels = ref<string[]>([]);
const loadingModels = ref(false);

const providers = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google Gemini", value: "gemini" },
  { label: "Ollama (Local)", value: "ollama" },
  { label: "Custom", value: "custom" },
];

const providerItems = computed(() => providers);
const ollamaModelItems = computed(() => {
  if (loadingModels.value) return [{ label: "正在加载模型列表...", value: "" }];
  if (ollamaModels.value.length === 0) return [{ label: "未找到模型", value: "" }];
  return ollamaModels.value.map((m) => ({ label: m, value: m }));
});

watch(
  () => globalConfig.value.provider,
  (newProvider) => {
    const defaults = Object.values(urls);
    if (!globalConfig.value.baseUrl || defaults.includes(globalConfig.value.baseUrl)) {
      updateGlobalConfig({ baseUrl: urls[newProvider] });
    }

    if (newProvider === "ollama") {
      fetchOllamaModels();
    }
  }
);

if (globalConfig.value.provider === "ollama") {
  fetchOllamaModels();
}

async function fetchOllamaModels() {
  loadingModels.value = true;
  try {
    const models = await AIService.getModels(globalConfig.value);
    ollamaModels.value = models;
  } catch (e) {
    console.error(e);
    toast.show("获取模型列表失败", "error");
  } finally {
    loadingModels.value = false;
  }
}

async function handleTest() {
  testing.value = true;
  testResult.value = "";
  try {
    const success = await AIService.testConnection(globalConfig.value);
    if (success) {
      toast.show("连接成功！", "success");
      testResult.value = "连接成功";
    } else {
      toast.show("连接失败，请检查配置", "error");
      testResult.value = "连接失败";
    }
  } catch (e: any) {
    toast.show(`连接出错: ${e.message}`, "error");
    testResult.value = `错误: ${e.message}`;
  } finally {
    testing.value = false;
  }
}

function updateProvider(val: string) {
  updateGlobalConfig({ provider: val as any });
}
</script>

<template>
  <div class="AIGlobalSettingBox">
    <!-- Provider Selector -->
    <div class="row">
      <Selector
        label="服务提供商"
        :model-value="globalConfig.provider"
        :items="providerItems"
        @update:model-value="updateProvider"
        class="setting-input-width"
      />
    </div>

    <!-- API Base URL -->
    <div class="row">
      <Input
        label="API Base URL"
        :model-value="globalConfig.baseUrl"
        @update:model-value="(val) => updateGlobalConfig({ baseUrl: val })"
        placeholder="https://api.openai.com/v1"
        class="setting-input-width"
      />
    </div>

    <!-- API Key (not for Ollama) -->
    <div class="row" v-if="globalConfig.provider !== 'ollama'">
      <Input
        type="text"
        label="API Key"
        :model-value="globalConfig.apiKey"
        @update:model-value="(val) => updateGlobalConfig({ apiKey: val })"
        placeholder="sk-..."
        class="setting-input-width"
      />
    </div>

    <!-- Model Selection -->
    <div class="row">
      <div v-if="globalConfig.provider === 'ollama'" class="ollama-model-row">
        <Selector
          label="模型 (Model)"
          :model-value="globalConfig.model"
          :items="ollamaModelItems"
          @update:model-value="(val) => updateGlobalConfig({ model: val })"
          class="setting-input-width"
        />
        <button class="refresh-btn" @click="fetchOllamaModels" title="刷新模型列表">
          <AppIcon name="refresh" />
        </button>
      </div>
      <Input
        v-else
        label="模型 (Model)"
        :model-value="globalConfig.model"
        @update:model-value="(val) => updateGlobalConfig({ model: val })"
        placeholder="gpt-3.5-turbo"
        class="setting-input-width"
      />
    </div>

    <!-- Temperature Slider -->
    <div class="row full-width">
      <Slider
        label="随机性 (Temperature)"
        :model-value="globalConfig.temperature"
        :min="0"
        :max="1"
        :step="0.1"
        @update:model-value="(val) => updateGlobalConfig({ temperature: val })"
      />
    </div>

    <!-- Test Connection -->
    <div class="actions">
      <button class="test-btn" @click="handleTest" :disabled="testing">
        {{ testing ? "测试中..." : "测试连接" }}
      </button>
      <span
        class="test-result"
        :class="{ error: testResult.includes('失败') || testResult.includes('错误') }"
      >
        {{ testResult }}
      </span>
    </div>
  </div>
</template>

<style lang="less" scoped>
.AIGlobalSettingBox {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
  max-width: 600px;

  .row {
    display: flex;
    align-items: center;

    :deep(.input-container),
    :deep(.Selector) {
      width: 100%;
      .label {
        width: 120px;
        min-width: 120px;
        font-size: 13px;
      }

      .Input,
      .selector-container {
        width: 300px;
        flex: none;
      }
    }

    &.full-width {
      width: 100%;
      max-width: 430px;
    }

    .ollama-model-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;

      .refresh-btn {
        background: var(--background-color-2);
        border: 1px solid var(--border-color-1);
        color: var(--text-color-1);
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover {
          background: var(--hover-background-color);
          border-color: var(--primary-color);
        }
      }
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
    padding-left: 130px;

    .test-btn {
      padding: 8px 20px;
      background: var(--primary-color);
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
    }

    .test-result {
      font-size: 13px;
      color: #4caf50;
      font-weight: 500;
      &.error {
        color: #f44336;
      }
    }
  }
}
</style>
