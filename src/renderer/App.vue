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
import KnowledgeBaseList from "./knowledge-base/views/KnowledgeBaseList.vue";
import KnowledgeBaseView from "./knowledge-base/views/KnowledgeBaseView.vue";
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
  closeAllTabs,
  clearAllTabs,
  openFile,
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

// 应用模式：编辑器 / 知识库
type AppMode = "editor" | "knowledgeBase";
type ModeTransition = "idle" | "opening" | "closing";
const appMode = ref<AppMode>("editor");
const modeTransition = ref<ModeTransition>("idle");
const kbView = ref<"list" | "view">("list");
const currentKb = ref<KnowledgeBaseInfo | null>(null);
const switchingToMode = ref<"editor" | "knowledgeBase" | null>(null);
const pendingUnsavedTabs = ref<typeof tabs.value>([]);
let currentUnsavedTabIndex = 0;

// 根据当前模式切换状态
async function toggleMode() {
  if (appMode.value === "editor") {
    await goToKnowledgeBase();
  } else {
    await backToEditor();
  }
}

// 通知模式变化
function notifyModeChange(mode: "editor" | "knowledgeBase") {
  emitter.emit("app:mode-change", mode);
}

async function goToKnowledgeBase() {
  const unsavedTabs = getUnsavedTabs();
  if (unsavedTabs.length > 0) {
    pendingUnsavedTabs.value = unsavedTabs;
    currentUnsavedTabIndex = 0;
    switchingToMode.value = "knowledgeBase";
    await switchToTab(unsavedTabs[0].id);
    showDialog(unsavedTabs[0].name);
    return;
  }
  // 切换到知识库模式
  modeTransition.value = "closing"; // 先关闭编辑器
  await nextTick();
  // 等待动画完成后切换模式
  setTimeout(() => {
    appMode.value = "knowledgeBase";
    modeTransition.value = "opening"; // 打开知识库动画
    // 清空所有编辑器文件（不创建新文档）
    clearAllTabs();
    // 通知模式变化
    notifyModeChange("knowledgeBase");
  }, 200);
}

async function handleDialogSave() {
  if (switchingToMode.value) {
    await saveCurrentTab();
    processNextUnsavedTab();
  }
}

async function handleDialogDiscard() {
  if (switchingToMode.value) {
    const currentTab = pendingUnsavedTabs.value[currentUnsavedTabIndex];
    await cleanupTabLocalImages(currentTab);
    processNextUnsavedTab();
  }
}

function handleDialogCancel() {
  // 用户取消，留在编辑器模式
  switchingToMode.value = null;
  pendingUnsavedTabs.value = [];
}

function processNextUnsavedTab() {
  currentUnsavedTabIndex++;
  if (currentUnsavedTabIndex < pendingUnsavedTabs.value.length) {
    const nextTab = pendingUnsavedTabs.value[currentUnsavedTabIndex];
    switchToTab(nextTab.id);
    showDialog(nextTab.name);
  } else {
    // 所有文件处理完毕，切换到知识库模式（带动画）
    const targetMode = switchingToMode.value!;
    switchingToMode.value = null;
    pendingUnsavedTabs.value = [];
    
    if (targetMode === "knowledgeBase") {
      modeTransition.value = "closing";
      setTimeout(() => {
        appMode.value = "knowledgeBase";
        modeTransition.value = "opening";
        // 清空所有编辑器文件（不创建新文档）
        clearAllTabs();
        // 通知模式变化
        notifyModeChange("knowledgeBase");
      }, 200);
    } else {
      appMode.value = targetMode;
      notifyModeChange(targetMode);
    }
  }
}

async function backToEditor() {
  modeTransition.value = "closing"; // 先关闭知识库
  await nextTick();
  setTimeout(() => {
    appMode.value = "editor";
    modeTransition.value = "opening"; // 打开编辑器动画
    
    // 如果没有tabs，创建一个默认的空tab
    if (tabs.value.length === 0) {
      closeAllTabs();
    }
    // 通知模式变化
    notifyModeChange("editor");
  }, 200);
}

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

  emitter.on("kb:toggle", toggleMode);
  emitter.on("kb:go-to-list", goToKnowledgeBase);
  emitter.on("kb:back-to-editor", backToEditor);
  emitter.on("kb:open-kb", (kb: KnowledgeBaseInfo) => {
    currentKb.value = kb;
    kbView.value = "view";
  });
  emitter.on("kb:back-to-list", () => {
    currentKb.value = null;
    kbView.value = "list";
  });
  emitter.on("kb:open-file", async (filePath: string) => {
    // 打开知识库中的文件
    await openFile(filePath);
  });

  // 处理关闭最后一个tab时检查当前模式
  emitter.on("tab:check-editor-mode", (data: { tabId: string; isLastTab: boolean }) => {
    if (appMode.value === "editor") {
      // 编辑器模式下关闭最后一个tab，关闭应用
      window.electronAPI.closeDiscard();
    } else {
      // 知识库模式下，直接关闭tab即可
      close(data.tabId);
    }
  });

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
  emitter.off("kb:go-to-list", goToKnowledgeBase);
  emitter.off("kb:back-to-editor", backToEditor);
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
  <div class="app-root">
    <div class="mode-container" :class="`mode-${appMode}-${modeTransition}`">
      <div class="editor-mode-container">
        <div id="fontRoot">
          <!-- 多编辑器实例：每个 tab 拥有独立的编辑器，v-show 保持 DOM 存活 -->
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
      </div>

      <div class="knowledgeBase-mode-container">
        <KnowledgeBaseView
          v-if="kbView === 'view' && currentKb"
          :kb-path="currentKb.path"
          :kb-name="currentKb.name"
        />
        <KnowledgeBaseList v-else />
        <StatusBar
          :content="''"
        />
      </div>
    </div>
  </div>
  <SaveConfirmDialog
      :visible="isDialogVisible"
      :type="dialogType"
      :tab-name="tabName"
      :file-name="fileName"
      @save="switchingToMode ? handleDialogSave() : handleSave()"
      @discard="switchingToMode ? handleDialogDiscard() : handleDiscard()"
      @cancel="switchingToMode ? handleDialogCancel() : handleCancel()"
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
.app-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mode-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.editor-mode-container,
.knowledgeBase-mode-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

// 编辑器模式为默认可见
.editor-mode-container {
  opacity: 1;
  transform: translateX(0);
  z-index: 1;
}

.knowledgeBase-mode-container {
  opacity: 0;
  transform: translateX(100%);
  z-index: 2;
}

// 模式切换动画
.mode-container.mode-editor-idle {
  .editor-mode-container {
    opacity: 1;
    transform: translateX(0);
    z-index: 2;
  }
  .knowledgeBase-mode-container {
    opacity: 0;
    transform: translateX(100%);
    z-index: 1;
  }
}

.mode-container.mode-editor-opening {
  .editor-mode-container {
    opacity: 1;
    transform: translateX(0);
    z-index: 2;
  }
  .knowledgeBase-mode-container {
    opacity: 0;
    transform: translateX(100%);
    z-index: 1;
  }
}

.mode-container.mode-editor-closing {
  .editor-mode-container {
    opacity: 0;
    transform: translateX(-100%);
    z-index: 1;
  }
  .knowledgeBase-mode-container {
    opacity: 1;
    transform: translateX(0);
    z-index: 2;
  }
}

.mode-container.mode-knowledgeBase-idle {
  .editor-mode-container {
    opacity: 0;
    transform: translateX(-100%);
    z-index: 1;
  }
  .knowledgeBase-mode-container {
    opacity: 1;
    transform: translateX(0);
    z-index: 2;
  }
}

.mode-container.mode-knowledgeBase-opening {
  .editor-mode-container {
    opacity: 0;
    transform: translateX(-100%);
    z-index: 1;
  }
  .knowledgeBase-mode-container {
    opacity: 1;
    transform: translateX(0);
    z-index: 2;
  }
}

.mode-container.mode-knowledgeBase-closing {
  .editor-mode-container {
    opacity: 1;
    transform: translateX(0);
    z-index: 2;
  }
  .knowledgeBase-mode-container {
    opacity: 0;
    transform: translateX(100%);
    z-index: 1;
  }
}

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
