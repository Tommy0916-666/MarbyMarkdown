<script setup lang="ts">
import emitter from "@/renderer/events";
import { useContext } from "@/renderer/hooks/useContext";
import { useConfig } from "@/renderer/hooks/useConfig";
import useFont from "@/renderer/hooks/useFont";
import useOtherConfig from "@/renderer/hooks/useOtherConfig";
import { isShowOutline, toggleShowOutline } from "@/renderer/hooks/useOutline";
import { isShowAIChatSidebar, toggleAIChatSidebar, isAIChatFullscreen, aiChatFullscreenState, toggleAIChatFullscreen } from "@/renderer/hooks/useAIChatSidebar";
import { useSaveConfirmDialog } from "@/renderer/hooks/useSaveConfirmDialog";
import useSourceCode from "@/renderer/hooks/useSourceCode";
import useSpellCheck from "@/renderer/hooks/useSpellCheck";
import useTab from "@/renderer/hooks/useTab";
import useTheme from "@/renderer/hooks/useTheme";

import useWorkSpace from "@/renderer/hooks/useWorkSpace";
import { shouldAutoLoadWorkspace } from "@/renderer/utils/workspacePath";
import SaveConfirmDialog from "./components/dialogs/SaveConfirmDialog.vue";
import AutoSavePromptDialog from "./components/dialogs/AutoSavePromptDialog.vue";
import MarbymarkdownEditor from "./components/editor/MarbymarkdownEditor.vue";
import StatusBar from "./components/menu/StatusBar.vue";
import TitleBar from "./components/menu/TitleBar.vue";
import Outline from "./components/outline/Outline.vue";
import AIChatSidebar from "./components/ai-chat/AIChatSidebar.vue";
import useAutoSave from "@/renderer/hooks/useAutoSave";

// ✅ 应用级事件协调器（仅负责事件监听和协调）
useContext();

// ✅ 直接使用各个hooks（而不是通过useContext转发）
const { init: initTheme } = useTheme();
const { init: initFont } = useFont();
const { init: initOtherConfig } = useOtherConfig();
const { config, setConf } = useConfig();
const { openWorkSpaceByPath } = useWorkSpace();
const { isShowSource } = useSourceCode(); // 用于控制大纲显示
const { init: initSpellCheck } = useSpellCheck();
const {
  currentTab,
  tabs,
  activeTabId,
  close,
  saveCurrentTab,
  cleanupTabLocalImages,
  getUnsavedTabs,
  switchToTab,
  restoreLastOpenedFiles,
} = useTab();
const {
  isDialogVisible,
  dialogType,
  fileName,
  tabName,
  handleSave,
  handleDiscard,
  handleCancel,
  handleOverwrite,
  showDialog,
} = useSaveConfirmDialog();
const { startAutoSave } = useAutoSave();

// 自动保存弹窗
const isAutoSavePromptVisible = ref(false);

// 处理自动保存需要保存的事件
const handleAutoSaveNeedSave = () => {
  // 检查是否启用了提示弹窗
  if (config.value.autoSave?.enablePrompt) {
    isAutoSavePromptVisible.value = true;
  }
};

emitter.on("autoSave:needSavePrompt", handleAutoSaveNeedSave);

// 处理弹窗事件
const handlePromptSave = async () => {
  isAutoSavePromptVisible.value = false;
  await saveCurrentTab();
};

const handlePromptSkip = () => {
  isAutoSavePromptVisible.value = false;
};

const handlePromptDisable = () => {
  isAutoSavePromptVisible.value = false;
  setConf("autoSave", { ...config.value.autoSave, enabled: false });
};


// 编辑器类型：'milkdown' | 'marbymarkdown'
// 监听主进程的关闭确认事件
window.electronAPI.on("close:confirm", async () => {
  await handleSafeClose("close");
});

// 监听Tab关闭确认事件
const handleTabCloseConfirm = async (payload: any) => {
  const { tabId, tabName } = payload;
  const result = await showDialog(tabName);

  if (result === "save") {
    // 只有保存并成功才关闭
    const saved = await saveCurrentTab();
    if (saved) {
      close(tabId);
    }
  } else if (result === "discard") {
    // 放弃更改，直接关闭
    await cleanupTabLocalImages(tabs.value.find((tab) => tab.id === tabId));
    close(tabId);
  }
  // cancel 则不做任何操作
};
emitter.on("tab:close-confirm", handleTabCloseConfirm);


import { onMounted, onUnmounted, ref, watch, nextTick, computed } from "vue";
// 大纲侧边栏两阶段动画状态机
// closed: 隐藏 | opening: transform 滑入动画 | open: flex 正常布局 | closing-prep: 切回 transform 定位 | closing: transform 滑出动画
type OutlineState = "closed" | "opening" | "open" | "closing-prep" | "closing";
const initialOutlineVisible = Boolean(config.value.workspace?.autoExpandSidebar);
toggleShowOutline(initialOutlineVisible);
const outlineState = ref<OutlineState>(initialOutlineVisible ? "open" : "closed");

// AI 聊天侧边栏两阶段动画状态机
type AIChatSidebarState = "closed" | "opening" | "open" | "closing-prep" | "closing";
const aiChatSidebarState = ref<AIChatSidebarState>("closed");
const editorAreaRef = ref<HTMLElement | null>(null);

const outlineClass = computed(() => `outline-${outlineState.value}`);
const aiChatSidebarClass = computed(() => `ai-chat-sidebar-${aiChatSidebarState.value}`);

// AI 聊天全屏动画状态机
type AIChatFullscreenState = "idle" | "opening-prep" | "opening" | "open" | "closing-prep" | "closing";
const aiChatFullscreenStateInternal = ref<AIChatFullscreenState>("idle");
const aiChatFullscreenClass = computed(() => `ai-chat-fullscreen-${aiChatFullscreenStateInternal.value}`);

watch(isShowOutline, async (val) => {
  if (val) {
    outlineState.value = "opening";
  } else {
    // 先瞬间切回 transform 定位（视觉位置不变，无动画）
    outlineState.value = "closing-prep";
    await nextTick();
    editorAreaRef.value?.offsetHeight; // 强制浏览器应用样式
    outlineState.value = "closing";
  }
});

watch(isShowAIChatSidebar, async (val) => {
  if (val) {
    aiChatSidebarState.value = "opening";
  } else {
    // 先瞬间切回 transform 定位（视觉位置不变，无动画）
    aiChatSidebarState.value = "closing-prep";
    await nextTick();
    editorAreaRef.value?.offsetHeight; // 强制浏览器应用样式
    aiChatSidebarState.value = "closing";
  }
});

// 监听全屏状态，处理动画
watch(isAIChatFullscreen, async (val) => {
  if (val) {
    // 打开全屏：先准备，再过渡
    aiChatFullscreenStateInternal.value = "opening-prep";
    await nextTick();
    editorAreaRef.value?.offsetHeight; // 强制浏览器应用样式
    aiChatFullscreenStateInternal.value = "opening";
  } else {
    // 关闭全屏
    aiChatFullscreenStateInternal.value = "closing-prep";
    await nextTick();
    editorAreaRef.value?.offsetHeight; // 强制浏览器应用样式
    aiChatFullscreenStateInternal.value = "closing";
  }
});

function onTransitionEnd(e: TransitionEvent) {
  if (e.propertyName !== "transform" && e.propertyName !== "width") return;
  
  // 处理大纲侧边栏
  if (outlineState.value === "opening") {
    outlineState.value = "open";
  } else if (outlineState.value === "closing") {
    outlineState.value = "closed";
  }
  
  // 处理 AI 聊天侧边栏
  if (aiChatSidebarState.value === "opening") {
    aiChatSidebarState.value = "open";
  } else if (aiChatSidebarState.value === "closing") {
    aiChatSidebarState.value = "closed";
  }
  
  // 处理 AI 聊天全屏
  if (aiChatFullscreenStateInternal.value === "opening") {
    aiChatFullscreenStateInternal.value = "open";
  } else if (aiChatFullscreenStateInternal.value === "closing") {
    aiChatFullscreenStateInternal.value = "idle";
  }
}

onMounted(async () => {
  initTheme();
  initFont();
  initOtherConfig();
  initSpellCheck();
  
  // 恢复上次打开的文件
  await restoreLastOpenedFiles();
  
  const startupPath = config.value.workspace?.startupPath;
  if (startupPath && shouldAutoLoadWorkspace(startupPath)) {
    window.electronAPI.workspaceExists(startupPath).then((exists) => {
      if (exists) {
        openWorkSpaceByPath(startupPath);
      }
    });
  }
});
onUnmounted(() => {
  emitter.off("tab:close-confirm", handleTabCloseConfirm);
  emitter.off("autoSave:needSavePrompt", handleAutoSaveNeedSave);
});

// Reuse safe close logic
async function handleSafeClose(action: "close") {
  const unsavedTabs = getUnsavedTabs();
  if (unsavedTabs.length === 0) {
    window.electronAPI.closeDiscard();
    return;
  }

  for (const tab of unsavedTabs) {
    // 切换到该tab以便用户查看
    await switchToTab(tab.id);

    // 弹出保存确认框
    const result = await showDialog(tab.name);

    if (result === "cancel") {
      // 用户取消关闭操作，中止后续流程
      return;
    }

    if (result === "save") {
      const saved = await saveCurrentTab();
      if (!saved) {
        // 保存失败，中止关闭
        return;
      }
    } else {
      await cleanupTabLocalImages(tab);
    }
  }

  // 所有此轮检查都通过（保存或丢弃），强制关闭
  window.electronAPI.closeDiscard();
}
</script>

<template>
  <TitleBar />
  <div id="fontRoot">
    <!-- ✅ 多编辑器实例：每个 tab 拥有独立的编辑器，v-show 保持 DOM 存活 -->
    <div ref="editorAreaRef" class="editorArea" :class="[outlineClass, aiChatSidebarClass, aiChatFullscreenClass]">
      <div class="outlineBox">
        <Outline />
      </div>
      <div class="editorBox" @transitionend="onTransitionEnd">
        <!-- Marbymarkdown 编辑器（每个 tab 独立实例） -->
        <MarbymarkdownEditor
          v-for="tab in tabs"
          :key="tab.id"
          v-show="tab.id === activeTabId"
          :tab="tab"
          :is-active="tab.id === activeTabId"
        />
      </div>
      <div class="aiChatSidebarBox">
        <AIChatSidebar />
      </div>
    </div>
  </div>
  <StatusBar
    :content="currentTab?.content ?? ''"
  />
  <SaveConfirmDialog
    :visible="isDialogVisible"
    :type="dialogType"
    :tab-name="tabName"
    :file-name="fileName"
    @save="handleSave"
    @discard="handleDiscard"
    @cancel="handleCancel"
    @overwrite="handleOverwrite"
  />
  <AutoSavePromptDialog
    :visible="isAutoSavePromptVisible"
    @save="handlePromptSave"
    @skip="handlePromptSkip"
    @disable="handlePromptDisable"
  />
</template>

<style scoped lang="less">
#fontRoot {
  height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editorArea {
  height: 0;
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;

  // 默认：大纲侧边栏隐藏在左侧外
  .outlineBox {
    position: absolute;
    left: 0;
    top: 0;
    width: 25%;
    height: 100%;
    z-index: 10;
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
    transition:
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  // 默认：AI 聊天侧边栏隐藏在右侧外
  .aiChatSidebarBox {
    position: absolute;
    right: 0;
    top: 0;
    width: 25%;
    height: 100%;
    z-index: 10;
    transform: translateX(100%);
    opacity: 0;
    pointer-events: none;
    transition:
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }

  .editorBox {
    flex: 1;
    width: 100%;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }

  // 大纲侧边栏状态
  &.outline-opening {
    .outlineBox { transform: translateX(0); opacity: 1; pointer-events: auto; }
    .editorBox { transform: translateX(25%); }
  }
  &.outline-open {
    .outlineBox { position: relative; transform: none; opacity: 1; pointer-events: auto; flex-shrink: 0; transition: none; }
    .editorBox { width: 0; transform: none; transition: none; }
  }
  &.outline-closing-prep {
    .outlineBox { position: absolute; transform: translateX(0); opacity: 1; pointer-events: auto; transition: none; }
    .editorBox { width: 100%; transform: translateX(25%); transition: none; }
  }
  &.outline-closing {
    .outlineBox { position: absolute; transform: translateX(-100%); opacity: 0; pointer-events: none; transition: transform 0.2s ease, opacity 0.2s ease; }
    .editorBox { width: 100%; transform: translateX(0); transition: transform 0.2s ease; }
  }

  // AI 聊天侧边栏状态
  &.ai-chat-sidebar-opening {
    .aiChatSidebarBox { transform: translateX(0); opacity: 1; pointer-events: auto; }
    .editorBox { transform: translateX(-25%); }
  }
  &.ai-chat-sidebar-open {
    .aiChatSidebarBox { position: relative; transform: none; opacity: 1; pointer-events: auto; flex-shrink: 0; transition: none; }
    .editorBox { width: 0; transform: none; transition: none; }
  }
  &.ai-chat-sidebar-closing-prep {
    .aiChatSidebarBox { position: absolute; transform: translateX(0); opacity: 1; pointer-events: auto; transition: none; }
    .editorBox { width: 100%; transform: translateX(-25%); transition: none; }
  }
  &.ai-chat-sidebar-closing {
    .aiChatSidebarBox { position: absolute; transform: translateX(100%); opacity: 0; pointer-events: none; transition: transform 0.2s ease, opacity 0.2s ease; }
    .editorBox { width: 100%; transform: translateX(0); transition: transform 0.2s ease; }
  }

  // 两个都打开的情况
  &.outline-open.ai-chat-sidebar-open {
    .outlineBox { position: relative; width: 25%; }
    .aiChatSidebarBox { position: relative; width: 25%; }
    .editorBox { width: 50%; }
  }
  
  // 同时处理一个打开一个关闭的情况
  &.outline-opening.ai-chat-sidebar-open,
  &.outline-open.ai-chat-sidebar-opening,
  &.outline-closing-prep.ai-chat-sidebar-open,
  &.outline-open.ai-chat-sidebar-closing-prep,
  &.outline-closing.ai-chat-sidebar-open,
  &.outline-open.ai-chat-sidebar-closing {
    &.outline-open .outlineBox { position: relative; width: 25%; }
    &.ai-chat-sidebar-open .aiChatSidebarBox { position: relative; width: 25%; }
  }
  
  // AI聊天全屏模式 - 完美流畅的动画，完全像侧边栏！
  &.ai-chat-fullscreen-opening-prep {
    .aiChatSidebarBox { position: absolute; right: 0; top: 0; width: 25%; height: 100%; z-index: 10; transition: none; }
  }
  &.ai-chat-fullscreen-opening {
    .aiChatSidebarBox { position: absolute; right: 0; top: 0; width: 80%; height: 100%; z-index: 10; transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
  }
  &.ai-chat-fullscreen-open {
    .aiChatSidebarBox { position: relative; width: 80%; flex-shrink: 0; transition: none; }
  }
  &.ai-chat-fullscreen-closing-prep {
    .aiChatSidebarBox { position: absolute; right: 0; top: 0; width: 80%; height: 100%; z-index: 10; transition: none; }
  }
  &.ai-chat-fullscreen-closing {
    .aiChatSidebarBox { position: absolute; right: 0; top: 0; width: 25%; height: 100%; z-index: 10; transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
  }
  &.ai-chat-fullscreen-idle {
    /* 什么都不做 */
  }
}

/* editorArea的z-index */
.editorArea {
  z-index: 10;
}
</style>
