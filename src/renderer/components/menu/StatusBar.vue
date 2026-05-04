<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import SoundscapeControlPanel from "@/renderer/components/soundscape/SoundscapeControlPanel.vue";
import { toggleShowOutline } from "@/renderer/hooks/useOutline";
import useSourceCode from "@/renderer/hooks/useSourceCode";
import useTab from "@/renderer/hooks/useTab";
import useAutoSave from "@/renderer/hooks/useAutoSave";
import { useConfig } from "@/renderer/hooks/useConfig";
import { useAIConfig } from "@/renderer/hooks/useAIConfig";
import { toggleAIChatSidebar } from "@/renderer/hooks/useAIChatSidebar";
import { version } from "../../../../package.json";
import emitter from "@/renderer/events";
import type { Tab } from "@/types/tab";

const props = defineProps<{
  content: string;
  kbCurrentTab?: Tab | null;
  isKnowledgeBase?: boolean;
}>();

const { isShowSource, toggleSourceCode } = useSourceCode();
const { currentTab, saveCurrentTab } = useTab();
const { config, setConf } = useConfig();
const { isChatEnabled } = useAIConfig();

const currentAppMode = ref<"editor" | "knowledgeBase">("editor");

emitter.on("app:mode-change", (mode: "editor" | "knowledgeBase") => {
  currentAppMode.value = mode;
});

function handleSidebarToggle() {
  if (props.isKnowledgeBase) {
    emitter.emit("kb:sidebar-toggle");
  } else {
    toggleShowOutline();
  }
}

// 计算当前显示的tab，用于保存状态
const displayedTab = computed(() => {
  return props.isKnowledgeBase && props.kbCurrentTab ? props.kbCurrentTab : currentTab.value;
});
const {
  autoSaveConfig,
  lastAutoSaveTime,
  isSaving,
  hasRollbackContent,
  getRollbackContent,
  clearRollbackContent,
  triggerManualSave,
} = useAutoSave();

const mode = ref<"chars" | "lines">("chars");
const hasRollback = ref(false);

const displayText = computed(() => {
  const text = props.content ?? "";
  switch (mode.value) {
    case "chars":
      return `${countMarkdownChars(text)} 字符`;
    case "lines":
      return `${countMarkdownLines(text)} 行`;
    default:
      return "";
  }
});

const saveStatus = computed(() => {
  if (isSaving.value) {
    return { type: "saving", text: "保存中" };
  }

  // 检查是否有未保存的修改
  if (displayedTab.value?.isModified) {
    return { type: "unsaved", text: "未保存" };
  }

  if (!displayedTab.value?.filePath) {
    return null;
  }

  // 检查是否有自动保存的回滚内容
  if (autoSaveConfig.enabled && hasRollback.value) {
    const timeStr = lastAutoSaveTime.value
      ? new Date(lastAutoSaveTime.value).toLocaleTimeString()
      : "";
    return {
      type: "autosaved",
      text: `已保存 (自动保存) ${timeStr}`,
      hasRollback: true,
    };
  }

  // 普通手动保存
  const timeStr = lastAutoSaveTime.value
    ? new Date(lastAutoSaveTime.value).toLocaleTimeString()
    : "";
  return {
    type: "saved",
    text: `已保存 ${timeStr}`,
    hasRollback: false,
  };
});

// 更新回滚状态
async function updateRollbackStatus() {
  // 使用可选链，避免访问 undefined 属性
  const enabled = autoSaveConfig?.enabled ?? true;
  const enableRollback = autoSaveConfig?.enableRollback ?? true;
  
  if (!displayedTab.value?.filePath || !enabled || !enableRollback) {
    hasRollback.value = false;
    return;
  }
  
  const rollbackExists = await hasRollbackContent(displayedTab.value.filePath);
  hasRollback.value = rollbackExists;
}

onMounted(() => {
  updateRollbackStatus();
  // 监听自动保存完成事件
  emitter.on("autoSave:performed", () => {
    updateRollbackStatus();
  });
});

// 监听自动保存配置的变化
watch(
  () => autoSaveConfig,
  () => {
    updateRollbackStatus();
  },
  { deep: true }
);

// 监听文件变化和自动保存事件，更新回滚状态
watch(displayedTab, () => {
  updateRollbackStatus();
}, { deep: true });

watch(lastAutoSaveTime, () => {
  updateRollbackStatus();
});

function cycleMode() {
  if (mode.value === "chars") mode.value = "lines";
  else if (mode.value === "lines") mode.value = "chars";
}

function countMarkdownLines(text: string, options = { skipEmpty: true }): number {
  if (!text) return 0;
  const rawLines = text.split(/\n{2,}|<br\s*\/?>| {2}\n/g);
  if (options.skipEmpty) {
    return rawLines.filter((line) => line.trim().length > 0).length;
  }
  return rawLines.length;
}

function countMarkdownChars(text: string): number {
  const base64Regex = /data:image\/[a-zA-Z]+;base64,[a-zA-Z0-9+/=]+/g;
  return (text.replaceAll("&#x20;", "").replace(base64Regex, "image").trim() || "").split("")
    .length;
}

async function handleRollback() {
  const tabToRollback = displayedTab.value;
  if (!tabToRollback?.filePath) return;
  const rollbackContent = await getRollbackContent(tabToRollback.filePath);
  if (!rollbackContent) return;

  // 回滚内容，标记为已修改，让用户决定是否保存
  tabToRollback.content = rollbackContent;
  tabToRollback.isModified = true;
  // 发送事件，让编辑器更新
  emitter.emit("file:Change");
  // 清除回滚内容
  await clearRollbackContent(tabToRollback.filePath);
  // 更新回滚状态
  hasRollback.value = false;
}

function handleAIChatToggle() {
  if (props.isKnowledgeBase) {
    emitter.emit("global:toggle-ai-chat");
  } else {
    toggleAIChatSidebar();
  }
}

function toggleAutoSave() {
  setConf("autoSave", { ...config.value.autoSave, enabled: !config.value.autoSave.enabled });
}

window.electronAPI.on("view:toggleView", () => {
  toggleSourceCode();
});
</script>

<template>
  <div class="StatusBarBox">
    <div class="left-section">
      <div>
        <span class="status-icon-btn" @click="handleSidebarToggle">
          <AppIcon name="List-outlined" />
        </span>
        <span class="status-icon-btn" @click.stop="toggleSourceCode()">
          <AppIcon :name="isShowSource ? 'input' : 'markdown'" />
        </span>
        <span class="status-icon-btn knowledge-base-btn" @click="() => emitter.emit('kb:toggle')" title="知识库">
          <AppIcon name="library" />
        </span>
      </div>
      <div v-if="saveStatus" class="save-status">
        <AppIcon
          :name="
            saveStatus.type === 'saving'
              ? 'refresh'
              : saveStatus.type === 'unsaved'
              ? 'warning-outline'
              : 'check-circle'
          "
          :class="{ 'status-icon': true, 'saving-icon': saveStatus.type === 'saving' }"
        />
        <span class="status-text">{{ saveStatus.text }}</span>
      </div>
    </div>

    <div class="center-section">
      <span class="version-text">MarbyMarkdown V{{ version }}</span>
    </div>

    <div class="right-section">
      <SoundscapeControlPanel />
      <button
        v-if="isChatEnabled"
        class="ai-chat-btn"
        @click="handleAIChatToggle"
        title="AI 聊天"
      >
        <AppIcon name="ai-chat" />
      </button>
      <button
        v-if="!props.isKnowledgeBase && (autoSaveConfig?.enabled ?? true) && (autoSaveConfig?.enableRollback ?? true) && displayedTab?.filePath && hasRollback"
        class="rollback-btn"
        @click="handleRollback"
        title="回退到自动保存前的内容"
      >
        <AppIcon name="refresh" />
      </button>
      <div class="auto-save-status" @click="toggleAutoSave">
        <span class="auto-save-text">
          {{ (autoSaveConfig?.enabled ?? true) ? "自动保存已启用 [" + Math.round((autoSaveConfig?.saveInterval ?? 30000) / 1000) + "秒]" : "自动保存未启用" }}
        </span>
      </div>
      <span class="statusBarText" @click="cycleMode">{{ displayText }}</span>
    </div>
  </div>
</template>

<style lang="less" scoped>
.StatusBarBox {
  user-select: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color-1);
  text-align: right;
  background: var(--background-color-2);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 8px;

  .left-section {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-self: start;
  }

  .center-section {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .version-text {
    font-size: 12px;
    color: var(--text-color-3);
  }

  .right-section {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-self: end;
  }

  .status-icon-btn {
    cursor: pointer;
    font-size: 14px;
    color: var(--text-color-2);
    padding: 4px;
    transition: color 0.2s;

    &:hover {
      color: var(--text-color-1);
    }
  }

  .save-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-color-3);

    .status-icon {
      font-size: 12px;
    }

    .status-icon.warning,
    .status-icon[name="warning-outline"],
    .status-icon[name="warning"] {
      color: #ed8936 !important;
    }

    .status-icon.success,
    .status-icon[name="check-circle"] {
      color: #48bb78 !important;
    }

    .saving-icon {
      animation: spin 1s linear infinite;
    }

    .status-text {
      margin-right: 8px;
    }
  }

  .ai-chat-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-color-3);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;

    &:hover {
      background: var(--hover-background-color);
      color: var(--primary-color);
    }
  }

  .rollback-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-color-3);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;

    &:hover {
      background: var(--hover-background-color);
      color: var(--primary-color);
    }
  }

  .auto-save-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-color-3);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      background: var(--hover-background-color);
    }
  }

  span {
    padding: 2px 8px;
    display: inline-block;

    &:hover {
      background: var(--hover-color);
    }
  }
}

.statusBarText {
  font-size: 12px;
  margin: 2px 0;
  color: var(--text-color-3);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
