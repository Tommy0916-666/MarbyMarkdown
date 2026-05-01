<script setup lang="ts">
import { ref, computed } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import { useAIConfig } from "@/renderer/hooks/useAIConfig";
import { AIService } from "@/renderer/services/ai";

const emit = defineEmits<{
  create: [name: string, description: string];
  cancel: [];
}>();

const { globalConfig } = useAIConfig();

const step = ref(1);
const name = ref("");
const description = ref("");
const isLoadingTitle = ref(false);
const isLoadingDescription = ref(false);
const titleError = ref<string | null>(null);
const descriptionError = ref<string | null>(null);

const hasAISettings = computed(() => {
  return !!(globalConfig.value.apiKey && globalConfig.value.baseUrl);
});

async function optimizeTitle() {
  if (!name.value.trim()) return;
  
  if (!hasAISettings.value) {
    titleError.value = "请先在设置中配置AI";
    setTimeout(() => { titleError.value = null; }, 3000);
    return;
  }
  
  isLoadingTitle.value = true;
  titleError.value = null;
  try {
    const optimized = await AIService.optimizeKnowledgeBaseTitle(
      globalConfig.value,
      name.value
    );
    if (optimized) name.value = optimized;
  } catch (e: any) {
    console.error("优化标题失败", e);
    let errorMsg = "AI润色失败，请检查配置后重试";
    if (e?.message?.includes("API")) {
      errorMsg = "API调用失败，请检查API密钥和网络";
    } else if (e?.message?.includes("network")) {
      errorMsg = "网络连接失败，请检查网络";
    }
    titleError.value = errorMsg;
    setTimeout(() => { titleError.value = null; }, 5000);
  } finally {
    isLoadingTitle.value = false;
  }
}

async function optimizeDescription() {
  if (!description.value.trim()) return;
  
  if (!hasAISettings.value) {
    descriptionError.value = "请先在设置中配置AI";
    setTimeout(() => { descriptionError.value = null; }, 3000);
    return;
  }
  
  isLoadingDescription.value = true;
  descriptionError.value = null;
  try {
    const optimized = await AIService.optimizeKnowledgeBaseDescription(
      globalConfig.value,
      description.value
    );
    if (optimized) description.value = optimized;
  } catch (e: any) {
    console.error("优化简介失败", e);
    let errorMsg = "AI润色失败，请检查配置后重试";
    if (e?.message?.includes("API")) {
      errorMsg = "API调用失败，请检查API密钥和网络";
    } else if (e?.message?.includes("network")) {
      errorMsg = "网络连接失败，请检查网络";
    }
    descriptionError.value = errorMsg;
    setTimeout(() => { descriptionError.value = null; }, 5000);
  } finally {
    isLoadingDescription.value = false;
  }
}

function nextStep() {
  if (step.value === 1 && name.value.trim()) {
    step.value = 2;
  }
}

function prevStep() {
  if (step.value > 1) {
    step.value--;
  }
}

function handleCreate() {
  if (name.value.trim()) {
    emit("create", name.value.trim(), description.value.trim());
  }
}
</script>

<template>
  <div class="wizard-overlay">
    <div class="wizard-container">
      <div class="wizard-header">
        <button class="close-btn" @click="$emit('cancel')">
          <AppIcon name="close" />
        </button>
        <h2 class="title">创建知识库</h2>
        <div class="steps-indicator">
          <div
            v-for="i in 2"
            :key="i"
            class="step-dot"
            :class="{ active: step >= i }"
          ></div>
        </div>
      </div>

      <div class="wizard-content">
        <!-- Step 1: Name -->
        <div v-if="step === 1" class="step-content">
          <div class="form-group">
            <label class="label">知识库名称</label>
            <div class="input-wrapper">
              <input
                v-model="name"
                type="text"
                class="input"
                placeholder="例如：我的编程笔记"
                maxlength="50"
                @keyup.enter="nextStep()"
                autofocus
              />
              <button
                class="ai-btn"
                :disabled="!name.trim() || isLoadingTitle"
                @click="optimizeTitle"
                :title="isLoadingTitle ? 'AI正在思考...' : '使用AI润色标题'"
              >
                <AppIcon v-if="isLoadingTitle" name="loading" class="spinning" />
                <AppIcon v-else name="ai-optimize" />
              </button>
            </div>
            <div v-if="isLoadingTitle" class="ai-status info">
              <AppIcon name="loading" class="spinning" />
              <span>AI正在思考，帮你润色标题...</span>
            </div>
            <div v-else-if="titleError" class="ai-status error">
              <AppIcon name="alert-circle" />
              <span>{{ titleError }}</span>
            </div>
          </div>
        </div>

        <!-- Step 2: Description -->
        <div v-if="step === 2" class="step-content">
          <div class="form-group">
            <label class="label">知识库简介</label>
            <div class="input-wrapper textarea-wrapper">
              <textarea
                v-model="description"
                class="textarea"
                placeholder="这个知识库是用来做什么的？（可选）"
                rows="4"
                maxlength="200"
              />
              <button
                class="ai-btn"
                :disabled="!description.trim() || isLoadingDescription"
                @click="optimizeDescription"
                :title="isLoadingDescription ? 'AI正在思考...' : '使用AI润色简介'"
              >
                <AppIcon v-if="isLoadingDescription" name="loading" class="spinning" />
                <AppIcon v-else name="ai-optimize" />
              </button>
            </div>
            <div v-if="isLoadingDescription" class="ai-status info">
              <AppIcon name="loading" class="spinning" />
              <span>AI正在思考，帮你润色简介...</span>
            </div>
            <div v-else-if="descriptionError" class="ai-status error">
              <AppIcon name="alert-circle" />
              <span>{{ descriptionError }}</span>
            </div>
            <div class="hint">
              好的简介可以让你更好地管理知识库，也便于日后查找。
            </div>
          </div>
        </div>
      </div>

      <div class="wizard-footer">
        <button
          v-if="step > 1"
          class="btn btn-secondary"
          @click="prevStep"
        >
          上一步
        </button>
        <div class="spacer"></div>
        <button
          class="btn btn-secondary"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          v-if="step === 1"
          class="btn btn-primary"
          :disabled="!name.trim()"
          @click="nextStep"
        >
          下一步
        </button>
        <button
          v-if="step === 2"
          class="btn btn-primary"
          @click="handleCreate"
        >
          创建知识库
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.wizard-container {
  background: var(--background-color);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.wizard-header {
  padding: 24px 24px 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 1px solid var(--border-color-1);
}

.close-btn {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-color-2);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--hover-background-color);
    color: var(--text-color);
  }
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 16px;
}

.steps-indicator {
  display: flex;
  gap: 8px;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color-1);
  transition: background 0.3s;

  &.active {
    background: var(--primary-color);
  }
}

.wizard-content {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.step-content {
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
    align-items: stretch;

    &.textarea-wrapper {
      align-items: flex-start;
    }
  }

  .input,
  .textarea {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: var(--background-color-1);
    color: var(--text-color);
    font-size: 15px;
    outline: none;
    transition: all 0.2s;

    &:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    &::placeholder {
      color: var(--text-color-3);
    }
  }

  .textarea {
    resize: none;
    line-height: 1.5;
  }

  .ai-btn {
    width: 44px;
    height: 44px;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: var(--background-color-1);
    color: var(--text-color-2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      border-color: var(--primary-color);
      color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 8%, transparent);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }
  }

  .hint {
    font-size: 13px;
    color: var(--text-color-3);
    margin-top: 4px;
    line-height: 1.5;
  }

  .ai-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    margin-top: 8px;
    font-size: 13px;
    transition: all 0.3s ease;

    &.info {
      background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      color: var(--primary-color);
    }

    &.error {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.wizard-footer {
  padding: 16px 24px 24px;
  display: flex;
  gap: 12px;
  border-top: 1px solid var(--border-color-1);
}

.spacer {
  flex: 1;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &.btn-secondary {
    background: var(--background-color-1);
    color: var(--text-color);
    border: 1px solid var(--border-color-1);

    &:hover {
      background: var(--hover-background-color);
    }
  }

  &.btn-primary {
    background: var(--primary-color);
    color: white;

    &:hover {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
