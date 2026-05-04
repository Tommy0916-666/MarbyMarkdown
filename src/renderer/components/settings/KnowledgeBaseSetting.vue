<script setup lang="ts">
import { onMounted, ref, computed, watch, inject } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import emitter from "@/renderer/events";
import { useConfig } from "@/renderer/hooks/useConfig";
import { useAIConfig } from "@/renderer/hooks/useAIConfig";
import { Slider } from "@renderer/components/ui/slider";
import Input from "@renderer/components/ui/input/Input.vue";
import Selector from "@renderer/components/ui/selector/Selector.vue";
import { AIService } from "@renderer/services/ai";
import useFile from "@/renderer/hooks/useFile";
import useContent from "@/renderer/hooks/useContent";
import {
  exportElementAsPDF,
  exportMarkdownAsWord,
  exportElementWithStylesAndImages,
  exportAsText,
  getActiveEditorElement,
  getActiveEditorSelector,
} from "@/renderer/utils/exports";
import toast from "autotoast.js";
import autotoast from "autotoast.js";

const { config, setConf } = useConfig();
const { knowledgeBaseConfig, updateKnowledgeBaseConfig, providerDefaultUrls: urls } = useAIConfig();
const { onSave, onSaveAs, currentTab: editorCurrentTab } = useFile();
const { isModified: editorIsModified, markdown } = useContent();

// 获取应用模式和知识库当前tab
const appMode = ref<"editor" | "knowledgeBase">("editor");
const kbCurrentTab = ref<any>(null);

// 监听应用模式变化
emitter.on("app:mode-change", (mode: "editor" | "knowledgeBase") => {
  appMode.value = mode;
});

// 计算当前是否在知识库模式
const isKnowledgeBaseMode = computed(() => appMode.value === "knowledgeBase");

// 计算当前的保存状态
const isModified = computed(() => {
  if (isKnowledgeBaseMode.value) {
    return kbCurrentTab.value?.isModified || false;
  }
  return editorIsModified.value;
});

// 计算当前的tab
const currentTab = computed(() => {
  if (isKnowledgeBaseMode.value) {
    return kbCurrentTab.value;
  }
  return editorCurrentTab.value;
});

// 监听知识库tab更新事件
emitter.on("kb:tab-updated", (tab: any) => {
  kbCurrentTab.value = tab;
});

// 监听保存事件来更新状态
emitter.on("autoSave:performed", () => {
  // 保存后状态会自动通过 kb:tab-updated 更新
});

// 定义知识库保存函数
async function kbSaveCurrentFile() {
  emitter.emit("kb:save-current");
}

// 重写 onSave 函数，根据模式选择不同的保存方式
function handleSave() {
  if (isKnowledgeBaseMode.value) {
    kbSaveCurrentFile();
  } else {
    onSave();
  }
}

// 知识库文件导出
function getKbExportBaseName() {
  return currentTab.value?.name?.slice(0, -3) || "知识库文件";
}

function exportKbAsPDF() {
  exportElementAsPDF(getActiveEditorSelector(), `${getKbExportBaseName()}.pdf`, {
    pageSize: "A4",
    scale: 1,
  })
    .then(() => {
      autotoast.show("导出成功", "success");
    })
    .catch((err) => {
      autotoast.show(`导出失败: ${err.message}`, "error");
    });
}
function exportKbAsHTML() {
  exportElementWithStylesAndImages(getActiveEditorElement(), `${getKbExportBaseName()}.html`);
}
function exportKbAsDocx() {
  exportMarkdownAsWord(markdown.value, `${getKbExportBaseName()}.docx`)
    .then(() => {
      autotoast.show("导出成功", "success");
    })
    .catch((err) => {
      autotoast.show(`导出失败: ${err.message}`, "error");
    });
}
function exportKbAsTxt() {
  exportAsText(markdown.value, `${getKbExportBaseName()}.txt`);
}

const kbRootPath = ref<string>("");
const knowledgeBases = ref<KnowledgeBaseInfo[]>([]);
const loading = ref(true);
const aiSettingsExpanded = ref(false);
const testing = ref(false);
const testResult = ref<string>("");
const ollamaModels = ref<string[]>([]);
const loadingModels = ref(false);

// 知识库是否使用全局AI配置
const useGlobalAIConfig = computed({
  get: () => config.value.knowledgeBase.useGlobalAIConfig,
  set: (value: boolean) => {
    setConf("knowledgeBase", { ...config.value.knowledgeBase, useGlobalAIConfig: value });
    if (!value) {
      updateKnowledgeBaseConfig({ useIndependentConfig: true });
    } else {
      updateKnowledgeBaseConfig({ useIndependentConfig: false });
    }
  }
});

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
  () => knowledgeBaseConfig.value.provider,
  (newProvider) => {
    const defaults = Object.values(urls);
    if (!knowledgeBaseConfig.value.baseUrl || defaults.includes(knowledgeBaseConfig.value.baseUrl)) {
      updateKnowledgeBaseConfig({ baseUrl: urls[newProvider] });
    }

    if (newProvider === "ollama") {
      fetchOllamaModels();
    }
  }
);

if (knowledgeBaseConfig.value.provider === "ollama") {
  fetchOllamaModels();
}

async function fetchOllamaModels() {
  loadingModels.value = true;
  try {
    const models = await AIService.getModels(knowledgeBaseConfig.value);
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
    const success = await AIService.testConnection(knowledgeBaseConfig.value);
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
  updateKnowledgeBaseConfig({ provider: val as any });
}

async function loadKbRootPath() {
  try {
    kbRootPath.value = await window.electronAPI.getKbRootPath();
    await loadKnowledgeBases();
  } catch (e) {
    console.error("获取知识库数据失败:", e);
  } finally {
    loading.value = false;
  }
}

async function loadKnowledgeBases() {
  try {
    knowledgeBases.value = await window.electronAPI.listKnowledgeBases();
  } catch (e) {
    console.error("加载知识库列表失败:", e);
  }
}

async function openInExplorer() {
  await window.electronAPI.openKbInExplorer();
}

async function openKbInExplorer(kbPath: string) {
  await window.electronAPI.openKbPath(kbPath);
}

function goToKbList() {
  emitter.emit("kb:go-to-list");
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

onMounted(() => {
  loadKbRootPath();
});
</script>

<template>
  <div class="KnowledgeBaseSettingBox">
    <!-- 头部标题区域 -->
    <div class="setting-header">
      <span class="title-badge">
        <AppIcon name="library" />
      </span>
      <div class="title-group">
        <h2 class="title">知识库</h2>
        <span class="desc">管理本地知识库的数据存储与配置</span>
      </div>
    </div>

    <!-- 设置内容区域 -->
    <div class="setting-content">
      <div class="setting-item">
        <label class="setting-label">数据目录</label>
        <div class="path-field">
          <div class="path-row">
            <div class="path-input" :class="{ empty: !kbRootPath }">
              <AppIcon name="folder-opened" />
              <span>{{ kbRootPath || "加载中..." }}</span>
            </div>
            <button type="button" class="action-btn" @click="openInExplorer">
              在资源管理器中打开
            </button>
          </div>
        </div>
      </div>

      <div class="setting-tip">
        <AppIcon name="info" class="tip-icon" />
        <span>知识库数据存储在本地用户目录下，每个知识库为一个子文件夹。</span>
      </div>

      <!-- 文件操作 -->
      <div class="kb-file-operations">
        <div class="title-row">
          <span class="title-badge">
            <AppIcon name="document" />
          </span>
          <div class="title-group">
            <h3 class="title">文件操作</h3>
            <span class="desc">对当前打开的知识库文件进行保存与导出操作</span>
          </div>
        </div>
        <div class="buttons">
          <button @click="handleSave">
            <AppIcon v-if="!isModified" name="circle-check" />
            <AppIcon v-else name="warning-outline" />
            <span>{{ isModified ? "保存" : "已保存" }}</span>
          </button>
          <button @click="onSaveAs">
            <AppIcon name="document-copy" />
            <span>另存为</span>
          </button>
        </div>
      </div>

      <!-- 导出为 -->
      <div class="kb-export-operations">
        <div class="title-row">
          <span class="title-badge export-badge">
            <AppIcon name="export-file" />
          </span>
          <div class="title-group">
            <h3 class="title">导出为</h3>
            <span class="desc">将当前知识库文件导出为不同格式文件</span>
          </div>
        </div>
        <div class="buttons">
          <button @click="exportKbAsPDF">
            <AppIcon name="pdf" />
            <span>PDF</span>
          </button>
          <button @click="exportKbAsHTML">
            <AppIcon name="html" />
            <span>HTML</span>
          </button>
          <button @click="exportKbAsDocx">
            <AppIcon name="word-file" />
            <span>Word</span>
          </button>
          <button @click="exportKbAsTxt">
            <AppIcon name="document" />
            <span>TXT</span>
          </button>
        </div>
      </div>

      <!-- AI配置选项 -->
      <div class="ai-config-section">
        <div class="ai-config-setting" @click="aiSettingsExpanded = !aiSettingsExpanded">
          <label class="ai-config-label" @click.stop>
            <input
              type="checkbox"
              v-model="useGlobalAIConfig"
            />
            <span class="ai-config-text">知识库功能使用全局AI配置</span>
          </label>
          <AppIcon
            name="arrow-right"
            class="expand-icon"
            :class="{ expanded: aiSettingsExpanded }"
            v-if="!useGlobalAIConfig"
          />
        </div>
        
        <!-- 独立AI配置，当不使用全局配置时显示 -->
        <div v-if="!useGlobalAIConfig && aiSettingsExpanded" class="independent-ai-config">
          <!-- Provider Selector -->
          <div class="config-row">
            <Selector
              label="服务提供商"
              :model-value="knowledgeBaseConfig.provider"
              :items="providerItems"
              @update:model-value="updateProvider"
              class="setting-input-width"
            />
          </div>

          <!-- API Base URL -->
          <div class="config-row">
            <Input
              label="API Base URL"
              :model-value="knowledgeBaseConfig.baseUrl"
              @update:model-value="(val) => updateKnowledgeBaseConfig({ baseUrl: val })"
              placeholder="https://api.openai.com/v1"
              class="setting-input-width"
            />
          </div>

          <!-- API Key (not for Ollama) -->
          <div class="config-row" v-if="knowledgeBaseConfig.provider !== 'ollama'">
            <Input
              type="text"
              label="API Key"
              :model-value="knowledgeBaseConfig.apiKey"
              @update:model-value="(val) => updateKnowledgeBaseConfig({ apiKey: val })"
              placeholder="sk-..."
              class="setting-input-width"
            />
          </div>

          <!-- Model Selection -->
          <div class="config-row">
            <div v-if="knowledgeBaseConfig.provider === 'ollama'" class="ollama-model-row">
              <Selector
                label="模型 (Model)"
                :model-value="knowledgeBaseConfig.model"
                :items="ollamaModelItems"
                @update:model-value="(val) => updateKnowledgeBaseConfig({ model: val })"
                class="setting-input-width"
              />
              <button class="refresh-btn" @click="fetchOllamaModels" title="刷新模型列表">
                <AppIcon name="refresh" />
              </button>
            </div>
            <Input
              v-else
              label="模型 (Model)"
              :model-value="knowledgeBaseConfig.model"
              @update:model-value="(val) => updateKnowledgeBaseConfig({ model: val })"
              placeholder="gpt-3.5-turbo"
              class="setting-input-width"
            />
          </div>

          <!-- Temperature Slider -->
          <div class="config-row full-width">
            <Slider
              label="随机性 (Temperature)"
              :model-value="knowledgeBaseConfig.temperature"
              :min="0"
              :max="1"
              :step="0.1"
              @update:model-value="(val) => updateKnowledgeBaseConfig({ temperature: val })"
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
      </div>

      <!-- 知识库列表 -->
      <div class="kb-list-section">
        <div class="section-title-row">
          <h3 class="section-title">知识库列表</h3>
          <button class="manage-all-btn" @click="goToKbList">
            管理全部
          </button>
        </div>
        <div v-if="loading" class="loading-state">
          <AppIcon name="loading" class="spinning" />
          加载中...
        </div>
        <div v-else-if="knowledgeBases.length === 0" class="empty-state">
          <AppIcon name="folder-opened" class="empty-icon" />
          <p>暂无知识库，点击"管理全部"创建</p>
        </div>
        <div v-else class="kb-list">
          <div
            v-for="kb in knowledgeBases"
            :key="kb.path"
            class="kb-item"
          >
            <div class="kb-info">
              <div class="kb-icon">
                <AppIcon name="folder-opened" />
              </div>
              <div class="kb-details">
                <div class="kb-name">{{ kb.name }}</div>
                <div class="kb-meta">
                  {{ formatDate(kb.createdAt) }}
                  <span v-if="kb.description"> · {{ kb.description }}</span>
                </div>
              </div>
            </div>
            <button
              class="open-folder-btn"
              @click="openKbInExplorer(kb.path)"
              title="在资源管理器中打开"
            >
              <AppIcon name="folder-opened" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.KnowledgeBaseSettingBox {
  display: flex;
  flex-direction: column;
  gap: 10px;

  // 头部标题样式
  .setting-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .title-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 14px;
    flex-shrink: 0;
    color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 14%, transparent);
    font-size: 18px;
  }

  .title-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.4;
    color: var(--text-color);
    margin: 0;
  }

  .desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-color-2);
  }

  .setting-content {
    padding-left: 70px;
    padding-right: 30px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  // 设置项样式
  .setting-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;

    .setting-label {
      min-width: 100px;
      padding-top: 10px;
      font-size: 14px;
      color: var(--text-color-1);
      flex-shrink: 0;
    }
  }

  .path-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .path-field {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .path-input {
    flex: 1;
    min-width: 280px;
    height: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: var(--background-color-1);
    color: var(--text-color-1);
    transition:
      border-color 0.2s ease,
      color 0.2s ease,
      background 0.2s ease;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.empty {
      color: var(--text-color-3);
    }
  }

  .action-btn {
    height: 40px;
    padding: 0 14px;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: var(--background-color-1);
    color: var(--text-color-1);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--border-color-2);
      background: var(--hover-background-color);
    }
  }

  .setting-tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-color-2);

    .tip-icon {
      flex-shrink: 0;
      margin-top: 2px;
      font-size: 14px;
      color: var(--primary-color);
    }
  }

  .kb-file-operations,
  .kb-export-operations {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 0;

    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 18px;
    }

    .title-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary-color) 14%, transparent);
      color: var(--primary-color);
      font-size: 18px;

      &.export-badge {
        background: color-mix(in srgb, #10b981 14%, transparent);
        color: #10b981;
      }
    }

    .title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-color);
      margin: 0;
    }

    .desc {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-color-2);
    }

    .buttons {
      display: flex;
      align-items: flex-start;
      flex-direction: column;
      gap: 14px;
      padding-left: 50px;
    }

    button {
      padding: 5px 10px;
      flex: 1;
      border: none;
      cursor: pointer;
      font-size: 16px;
      background: none;
      border-radius: 4px;
      transition: background-color 0.3s;
      color: var(--text-color);
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background-color: var(--border-color-1);
        border-color: var(--border-color-2);
      }

      svg {
        font-size: 18px;
        vertical-align: middle;
        margin-right: 5px;
      }
    }
  }

  .ai-config-setting {
    display: flex;
    align-items: center;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--background-color-2);
    border: 1px solid var(--border-color-1);
  }

  .ai-config-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .ai-config-text {
    font-size: 14px;
    color: var(--text-color);
  }

  .ai-config-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .expand-icon {
    font-size: 16px;
    color: var(--text-color-3);
    transition: transform 0.2s;
    margin-left: auto;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .independent-ai-config {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--background-color-1);
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
  }

  .config-row {
    display: flex;
    align-items: center;

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

  :deep(.setting-input-width) {
    .input-container,
    .Selector {
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
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
    padding-left: 130px;

    .test-btn {
      padding: 8px 18px;
      background: var(--primary-color);
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: opacity 0.2s;

      &:hover:not(:disabled) {
        opacity: 0.88;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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

  // 知识库列表
  .kb-list-section {
    background: var(--background-color-2);
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    padding: 16px;

    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }

    .manage-all-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      color: var(--primary-color);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: color-mix(in srgb, var(--primary-color) 16%, transparent);
      }
    }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 8px;
      color: var(--text-color-3);
      font-size: 14px;

      .spinning {
        animation: spin 1s linear infinite;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      gap: 12px;
      color: var(--text-color-3);
      font-size: 14px;
      text-align: center;

      .empty-icon {
        font-size: 40px;
        opacity: 0.4;
      }

      p {
        margin: 0;
      }
    }

    .kb-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .kb-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--background-color-1);
      transition: all 0.2s ease;

      &:hover {
        background: var(--hover-background-color);
      }

      .kb-info {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1;
      }

      .kb-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--primary-color) 10%, transparent);
        color: var(--primary-color);
        flex-shrink: 0;
      }

      .kb-details {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kb-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .kb-meta {
        font-size: 12px;
        color: var(--text-color-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .open-folder-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text-color-3);
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.2s ease;

        &:hover {
          background: var(--background-color-3);
          color: var(--primary-color);
        }
      }
    }
  }

  .manage-row {
    padding-top: 4px;
  }

  .manage-btn {
    height: 40px;
    padding: 0 18px;
    border: none;
    border-radius: 8px;
    background: var(--primary-color);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: opacity 0.2s ease;

    .btn-icon {
      font-size: 16px;
    }

    &:hover {
      opacity: 0.88;
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .KnowledgeBaseSettingBox {
    .setting-content {
      padding-left: 0;
      padding-right: 10px;
    }

    .setting-item {
      flex-direction: column;
      gap: 8px;

      .setting-label {
        min-width: auto;
        padding-top: 0;
      }
    }

    .path-input {
      min-width: 100%;
    }

    .actions {
      padding-left: 0;
    }

    :deep(.setting-input-width) {
      .input-container,
      .Selector {
        .Input,
        .selector-container {
          width: 100%;
        }
      }
    }
  }
}
</style>
