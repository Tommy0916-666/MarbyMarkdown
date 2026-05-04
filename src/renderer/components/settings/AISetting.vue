<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useAIConfig, type AIContinueMode } from "@/renderer/hooks/useAIConfig";
import {
  useShortcutConfig,
  formatKeyForDisplay,
  keyEventToProseMirrorKey,
} from "@/renderer/hooks/useShortcutConfig";
import { AIService } from "@/renderer/services/ai";
import toast from "autotoast.js";

import { Switch } from "@renderer/components/ui/switch";
import { Slider } from "@renderer/components/ui/slider";
import Input from "@renderer/components/ui/input/Input.vue";
import Selector from "@renderer/components/ui/selector/Selector.vue";
import AppIcon from "@renderer/components/ui/AppIcon.vue";

const { continueConfig, continueEffectiveConfig, updateContinueConfig, providerDefaultUrls: urls } = useAIConfig();
const { shortcuts, hasConflict, getConflictLabels, updateShortcut, clearShortcut, resetShortcut } = useShortcutConfig();

const testing = ref(false);
const testResult = ref("");
const ollamaModels = ref<string[]>([]);
const loadingModels = ref(false);
const recordingShortcut = ref<string | null>(null);

const providers = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google Gemini", value: "gemini" },
  { label: "Ollama (Local)", value: "ollama" },
  { label: "Custom", value: "custom" },
];

const modeOptions = [
  { label: "自动触发", value: "auto" },
  { label: "手动触发", value: "manual" },
];

const debounceOptions = [
  { label: "快 (1s)", value: "1000" },
  { label: "适中 (2s)", value: "2000" },
  { label: "慢 (3s)", value: "3000" },
];

const aiContinueShortcut = computed(() => {
  return shortcuts.value.find((s) => s.id === "aiContinue");
});

const aiAcceptShortcut = computed(() => {
  return shortcuts.value.find((s) => s.id === "aiAccept");
});

const providerItems = computed(() => providers);
const ollamaModelItems = computed(() => {
  if (loadingModels.value) return [{ label: "正在加载模型列表...", value: "" }];
  if (ollamaModels.value.length === 0) return [{ label: "未找到模型", value: "" }];
  return ollamaModels.value.map((m) => ({ label: m, value: m }));
});

watch(
  () => continueConfig.value.provider,
  (newProvider) => {
    const defaults = Object.values(urls);
    if (!continueConfig.value.baseUrl || defaults.includes(continueConfig.value.baseUrl)) {
      updateContinueConfig({ baseUrl: urls[newProvider] });
    }

    if (newProvider === "ollama") {
      fetchOllamaModels();
    }
  }
);

if (continueConfig.value.provider === "ollama") {
  fetchOllamaModels();
}

async function fetchOllamaModels() {
  loadingModels.value = true;
  try {
    const models = await AIService.getModels(continueConfig.value);
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
    const success = await AIService.testConnection(continueEffectiveConfig.value);
    if (success) {
      toast.show("连接成功！", "success");
      testResult.value = "连接成功";
    } else {
      toast.show("连接失败，请检查配置（控制台有详细日志）", "error");
      testResult.value = "连接失败";
    }
  } catch (e: any) {
    console.error("[AI Setting] Connection test exception:", e);
    toast.show(`连接出错: ${e.message}`, "error");
    testResult.value = `错误: ${e.message}`;
  } finally {
    testing.value = false;
  }
}

function updateProvider(val: string) {
  updateContinueConfig({ provider: val as any });
}

function updateMode(val: string) {
  updateContinueConfig({ mode: val as AIContinueMode });
}

function handleShortcutKeydown(e: KeyboardEvent, shortcutId: string) {
  if (recordingShortcut.value !== shortcutId) return;
  if (e.key === "Escape") {
    recordingShortcut.value = null;
    return;
  }
  if (e.key === "Backspace" || e.key === "Delete") {
    clearShortcut(shortcutId);
    recordingShortcut.value = null;
    return;
  }
  const k = keyEventToProseMirrorKey(e);
  if (k) {
    updateShortcut(shortcutId, k);
    recordingShortcut.value = null;
  }
}
</script>

<template>
  <div class="AISettingBox">
    <!-- 启用开关 -->
    <div class="row switch-row">
      <Switch
        :model-value="continueConfig.enabled"
        @update:model-value="(val) => updateContinueConfig({ enabled: val })"
        label="启用 AI 续写"
      />
    </div>

    <template v-if="continueConfig.enabled">
      <!-- 续写模式 -->
      <div class="row">
        <Selector
          label="触发模式"
          :model-value="continueConfig.mode"
          :items="modeOptions"
          @update:model-value="updateMode"
          class="setting-input-width"
        />
      </div>

      <!-- 触发延迟（仅自动模式） -->
      <div class="row" v-if="continueConfig.mode === 'auto'">
        <Selector
          label="触发延迟"
          :model-value="String(continueConfig.debounceWait || 2000)"
          :items="debounceOptions"
          @update:model-value="(val) => updateContinueConfig({ debounceWait: Number(val) })"
          class="setting-input-width"
        />
      </div>

      <!-- 快捷键设置 -->
      <div class="shortcut-section">
        <div class="row shortcut-row">
          <span class="setting-label">AI 续写快捷键</span>
          <div class="shortcut-key-area">
            <span
              v-if="aiContinueShortcut && hasConflict('aiContinue')"
              class="conflict-icon"
              :title="'与以下功能冲突：' + getConflictLabels('aiContinue').join('、')"
            >⚠</span>
            <div
              class="key-badge"
              :class="{
                recording: recordingShortcut === 'aiContinue',
                conflict: aiContinueShortcut && hasConflict('aiContinue'),
                modified: aiContinueShortcut && aiContinueShortcut.key !== aiContinueShortcut.defaultKey,
              }"
              tabindex="0"
              @click="recordingShortcut = 'aiContinue'"
              @keydown.prevent="handleShortcutKeydown($event, 'aiContinue')"
              @blur="recordingShortcut = null"
            >
              {{ recordingShortcut === 'aiContinue' ? "请按下新快捷键..." : aiContinueShortcut ? formatKeyForDisplay(aiContinueShortcut.key) : "未设置" }}
            </div>
            <div class="shortcut-actions">
              <button
                v-if="aiContinueShortcut && aiContinueShortcut.key"
                class="action-btn icon-btn"
                title="清除绑定"
                @click="clearShortcut('aiContinue')"
              >
                <AppIcon name="trash" />
              </button>
              <span v-else class="action-placeholder" aria-hidden="true"></span>
              <button
                v-if="aiContinueShortcut && aiContinueShortcut.key !== aiContinueShortcut.defaultKey"
                class="action-btn reset-btn"
                title="重置为默认值"
                @click="resetShortcut('aiContinue')"
              >
                ↺
              </button>
            </div>
          </div>
        </div>

        <div class="row shortcut-row">
          <span class="setting-label">接受 AI 续写快捷键</span>
          <div class="shortcut-key-area">
            <span
              v-if="aiAcceptShortcut && hasConflict('aiAccept')"
              class="conflict-icon"
              :title="'与以下功能冲突：' + getConflictLabels('aiAccept').join('、')"
            >⚠</span>
            <div
              class="key-badge"
              :class="{
                recording: recordingShortcut === 'aiAccept',
                conflict: aiAcceptShortcut && hasConflict('aiAccept'),
                modified: aiAcceptShortcut && aiAcceptShortcut.key !== aiAcceptShortcut.defaultKey,
              }"
              tabindex="0"
              @click="recordingShortcut = 'aiAccept'"
              @keydown.prevent="handleShortcutKeydown($event, 'aiAccept')"
              @blur="recordingShortcut = null"
            >
              {{ recordingShortcut === 'aiAccept' ? "请按下新快捷键..." : aiAcceptShortcut ? formatKeyForDisplay(aiAcceptShortcut.key) : "未设置" }}
            </div>
            <div class="shortcut-actions">
              <button
                v-if="aiAcceptShortcut && aiAcceptShortcut.key"
                class="action-btn icon-btn"
                title="清除绑定"
                @click="clearShortcut('aiAccept')"
              >
                <AppIcon name="trash" />
              </button>
              <span v-else class="action-placeholder" aria-hidden="true"></span>
              <button
                v-if="aiAcceptShortcut && aiAcceptShortcut.key !== aiAcceptShortcut.defaultKey"
                class="action-btn reset-btn"
                title="重置为默认值"
                @click="resetShortcut('aiAccept')"
              >
                ↺
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 独立配置开关 -->
      <div class="row switch-row">
        <Switch
          :model-value="continueConfig.useIndependentConfig"
          @update:model-value="(val) => updateContinueConfig({ useIndependentConfig: val })"
          label="使用独立配置"
        />
      </div>

      <!-- 独立配置内容 -->
      <template v-if="continueConfig.useIndependentConfig">
        <div class="row">
          <Selector
            label="服务提供商"
            :model-value="continueConfig.provider"
            :items="providerItems"
            @update:model-value="updateProvider"
            class="setting-input-width"
          />
        </div>

        <div class="row">
          <Input
            label="API Base URL"
            :model-value="continueConfig.baseUrl"
            @update:model-value="(val) => updateContinueConfig({ baseUrl: val })"
            placeholder="https://api.openai.com/v1"
            class="setting-input-width"
          />
        </div>

        <div class="row" v-if="continueConfig.provider !== 'ollama'">
          <Input
            type="text"
            label="API Key"
            :model-value="continueConfig.apiKey"
            @update:model-value="(val) => updateContinueConfig({ apiKey: val })"
            placeholder="sk-..."
            class="setting-input-width"
          />
        </div>

        <div class="row">
          <div v-if="continueConfig.provider === 'ollama'" class="ollama-model-row">
            <Selector
              label="模型 (Model)"
              :model-value="continueConfig.model"
              :items="ollamaModelItems"
              @update:model-value="(val) => updateContinueConfig({ model: val })"
              class="setting-input-width"
            />
            <button class="refresh-btn" @click="fetchOllamaModels" title="刷新模型列表">
              <AppIcon name="refresh" />
            </button>
          </div>
          <Input
            v-else
            label="模型 (Model)"
            :model-value="continueConfig.model"
            @update:model-value="(val) => updateContinueConfig({ model: val })"
            placeholder="gpt-3.5-turbo"
            class="setting-input-width"
          />
        </div>

        <div class="row full-width">
          <Slider
            label="随机性 (Temperature)"
            :model-value="continueConfig.temperature"
            :min="0"
            :max="1"
            :step="0.1"
            @update:model-value="(val) => updateContinueConfig({ temperature: val })"
          />
        </div>

        <!-- 测试连接按钮 -->
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
      </template>
    </template>
  </div>
</template>

<style lang="less" scoped>
.AISettingBox {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
  max-width: 600px;

  .row {
    display: flex;
    align-items: center;

    &.switch-row {
      padding-left: 0;
    }

    &.shortcut-row {
      .setting-label {
        width: 160px;
        min-width: 160px;
        font-size: 13px;
      }
    }

    &.full-width {
      width: 100%;
      max-width: 430px;
    }

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
        transition: all 0.3s;

        &:hover {
          background: var(--hover-background-color);
          border-color: var(--primary-color);
        }
      }
    }
  }

  .shortcut-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shortcut-key-area {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .conflict-icon {
    color: #e6a23c;
    font-size: 14px;
    cursor: help;
  }

  .key-badge {
    padding: 7px 12px;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: var(--background-color);
    color: var(--text-color);
    font-size: 12px;
    font-family: monospace;
    cursor: pointer;
    min-width: 160px;
    text-align: center;
    outline: none;
    user-select: none;
    white-space: nowrap;

    &:hover {
      border-color: var(--primary-color, #4a9eff);
    }

    &:focus {
      border-color: var(--primary-color, #4a9eff);
      box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
    }

    &.recording {
      border-color: var(--primary-color, #4a9eff);
      background: rgba(74, 158, 255, 0.1);
      color: var(--primary-color, #4a9eff);
      animation: pulse 1.5s infinite;
    }

    &.conflict {
      border-color: #e6a23c;
    }

    &.modified {
      border-color: var(--primary-color, #4a9eff);
      color: var(--primary-color, #4a9eff);
    }
  }

  .shortcut-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 70px;
    justify-content: flex-end;
  }

  .action-btn {
    width: 32px;
    min-width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: transparent;
    color: var(--text-color-2);
    font-size: 12px;
    cursor: pointer;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--hover-color);
      color: var(--text-color);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .icon-btn {
    font-size: 14px;
  }

  .reset-btn {
    font-size: 14px;
  }

  .action-placeholder {
    width: 32px;
    min-width: 32px;
    height: 32px;
    flex-shrink: 0;
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

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
