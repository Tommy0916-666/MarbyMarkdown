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
import type { Tab } from "@/types/tab";
import { readAndProcessFile, createTabDataFromFile } from "@/renderer/services/fileService";
import { randomUUID } from "@/renderer/utils/tool";

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
    // 如果当前是知识库模式！就单独处理知识库的关闭确认
    if (appMode.value === "knowledgeBase") {
      // 检查是否有未保存文件！
      const kbUnsaved = getKbUnsavedTabs();
      if (kbUnsaved.length === 0) {
        window.electronAPI.closeDiscard();
        return;
      } else {
        // 如果有未保存，逐个处理！
        // 用和切换模式切换编辑器一样的机制
        pendingUnsavedTabs.value = kbUnsaved;
        currentUnsavedTabIndex = 0;
        switchingToMode.value = "close";
        // 切换到第一个文件
        kbActiveTabId.value = kbUnsaved[0].id;
        emitter.emit("kb:tab-updated", kbUnsaved[0]);
        showDialog(kbUnsaved[0].name);
        return;
      }
    }
    // 如果不是知识库模式就按原来的处理！
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
const kbEditorAreaRef = ref<HTMLElement | null>(null);

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
const kbFileLoading = ref(false);
const isShowKBSidebar = ref(true);
const switchingToMode = ref<"editor" | "knowledgeBase" | null>(null);
const pendingUnsavedTabs = ref<typeof tabs.value>([]);
let currentUnsavedTabIndex = 0;

// 知识库独立tab系统
const kbTabs = ref<Tab[]>([]);
const kbActiveTabId = ref<string | null>(null);
const kbCurrentTab = computed(() => kbTabs.value.find(t => t.id === kbActiveTabId.value) ?? null);

// 知识库编辑器区域的侧边栏控制状态
const kbIsShowOutline = ref(false);
const kbIsShowAIChat = ref(false);
const kbIsAIChatFullscreen = ref(false);
const kbOutlineClass = computed(() => (kbIsShowOutline.value ? "show-outline" : "hide-outline"));
const kbAIChatSidebarClass = computed(() => (kbIsShowAIChat.value ? "show-ai-chat-sidebar" : "hide-ai-chat-sidebar"));
const kbAIChatFullscreenClass = computed(() => (kbIsAIChatFullscreen.value ? "ai-chat-fullscreen" : ""));

async function kbOpenFile(filePath: string) {
  kbFileLoading.value = true;
  try {
    // 检查文件是否已在知识库中打开
    const existingTabIndex = kbTabs.value.findIndex(tab => tab.filePath === filePath);
    if (existingTabIndex !== -1) {
      // 如果文件已打开，直接切换到该tab
      const existingTab = kbTabs.value[existingTabIndex];
      // 确保 isNewlyLoaded 为 false，避免编辑器重新处理
      existingTab.isNewlyLoaded = false;
      kbActiveTabId.value = existingTab.id;
      
      // 发送事件更新设置组件和视图
      emitter.emit("kb:tab-updated", existingTab);
      return;
    }

    // 如果文件未打开，读取并创建新tab
    const fileContent = await readAndProcessFile({ filePath });
    if (!fileContent) return;
    const tabData = createTabDataFromFile(fileContent.filePath, fileContent.content, { fileTraits: fileContent.fileTraits });
    const newTab: Tab = { ...tabData, id: randomUUID(), readOnly: fileContent.readOnly ?? false };
    // 添加到知识库tabs中（保留已打开的文件）
    kbTabs.value.push(newTab);
    kbActiveTabId.value = newTab.id;
    // 发送事件更新设置组件中的知识库tab
    emitter.emit("kb:tab-updated", newTab);
  } catch (e) {
    console.error("知识库打开文件失败:", e);
  } finally {
    kbFileLoading.value = false;
  }
}

// 保存知识库当前打开的文件
async function kbSaveCurrentFile() {
  if (!kbCurrentTab.value || !kbCurrentTab.value.filePath) return;
  if (!kbCurrentTab.value.isModified) return;
  try {
    await window.electronAPI.saveFile(kbCurrentTab.value.filePath, kbCurrentTab.value.content);
    kbCurrentTab.value.isModified = false;
    kbCurrentTab.value.markdownFileContent = kbCurrentTab.value.content;
    kbCurrentTab.value.originalContent = kbCurrentTab.value.content;
    emitter.emit("autoSave:performed");
    // 发送事件更新设置组件中的知识库tab
    emitter.emit("kb:tab-updated", kbCurrentTab.value);
  } catch (e) {
    console.error("保存知识库文件失败:", e);
  }
}

// 关闭KB当前tab
function kbCloseCurrentTab() {
  kbTabs.value = [];
  kbActiveTabId.value = null;
}

function toggleKBSidebar() {
  isShowKBSidebar.value = !isShowKBSidebar.value;
}

// 根据当前模式切换状态
async function handleToggleMode() {
  if (appMode.value === "editor") {
    await goToKnowledgeBase();
  } else {
    await backToEditor();
  }
}

// 保持向后兼容（别名）
const toggleMode = handleToggleMode;

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
  modeTransition.value = "closing";
  appMode.value = "knowledgeBase"; // 页面一旦切到KB，模式立即同步
  await nextTick();
  setTimeout(() => {
    modeTransition.value = "opening";
    clearAllTabs();
    notifyModeChange("knowledgeBase");
  }, 200);
}

async function handleDialogSave() {
  if (switchingToMode.value) {
    // 先手动关闭对话框！
    isDialogVisible.value = false;
    if (appMode.value === "knowledgeBase") {
      // 处理知识库的保存
      const currentTab = pendingUnsavedTabs.value[currentUnsavedTabIndex];
      try {
        await window.electronAPI.saveFile(currentTab.filePath!, currentTab.content);
        currentTab.isModified = false;
        currentTab.originalContent = currentTab.content;
      } catch (e) {
        console.error("保存知识库文件失败:", e);
      }
    } else {
      // 处理编辑器的保存
      await saveCurrentTab();
    }
    processNextUnsavedTab();
  }
}

async function handleDialogDiscard() {
  if (switchingToMode.value) {
    // 先手动关闭对话框！
    isDialogVisible.value = false;
    if (appMode.value !== "knowledgeBase") {
      const currentTab = pendingUnsavedTabs.value[currentUnsavedTabIndex];
      await cleanupTabLocalImages(currentTab);
    }
    processNextUnsavedTab();
  }
}

function handleDialogCancel() {
  // 用户取消，留在当前模式
  isDialogVisible.value = false;
  switchingToMode.value = null;
  pendingUnsavedTabs.value = [];
}

function processNextUnsavedTab() {
  currentUnsavedTabIndex++;
  if (currentUnsavedTabIndex < pendingUnsavedTabs.value.length) {
    const nextTab = pendingUnsavedTabs.value[currentUnsavedTabIndex];
    if (appMode.value === "knowledgeBase") {
      // 知识库模式：切换知识库tab
      kbActiveTabId.value = nextTab.id;
      emitter.emit("kb:tab-updated", nextTab);
    } else {
      // 编辑器模式：切换编辑器tab
      switchToTab(nextTab.id);
    }
    showDialog(nextTab.name);
  } else {
    // 所有文件处理完毕，执行目标操作
    const targetMode = switchingToMode.value!;
    switchingToMode.value = null;
    pendingUnsavedTabs.value = [];
    
    if (targetMode === "knowledgeBase") {
      // 切换到知识库模式
      modeTransition.value = "closing";
      appMode.value = "knowledgeBase";
      setTimeout(() => {
        modeTransition.value = "opening";
        clearAllTabs();
        notifyModeChange("knowledgeBase");
      }, 200);
    } else if (targetMode === "editor") {
      // 切换到编辑器模式
      proceedBackToEditor();
    } else if (targetMode === "close") {
      // 关闭程序！
      window.electronAPI.closeDiscard();
    }
  }
}

// 获取知识库中所有未保存的文件
function getKbUnsavedTabs() {
  return kbTabs.value.filter(tab => tab.isModified);
}

// 处理关闭知识库时的未保存检查
async function handleCloseKbConfirm() {
  const kbUnsavedTabs = getKbUnsavedTabs();
  
  if (kbUnsavedTabs.length === 0) {
    // 知识库文件没有未保存内容，直接返回编辑器
    proceedBackToEditor();
    return;
  }

  // 设置好待处理的未保存文件
  pendingUnsavedTabs.value = kbUnsavedTabs;
  currentUnsavedTabIndex = 0;
  switchingToMode.value = "editor";
  
  // 切换到第一个未保存文件
  const firstTab = kbUnsavedTabs[0];
  kbActiveTabId.value = firstTab.id;
  emitter.emit("kb:tab-updated", firstTab);
  
  // 显示对话框
  showDialog(firstTab.name);
}

// 保存知识库中所有未保存的文件
async function kbSaveAllUnsaved() {
  const kbUnsavedTabs = getKbUnsavedTabs();
  for (const tab of kbUnsavedTabs) {
    try {
      await window.electronAPI.saveFile(tab.filePath!, tab.content);
      tab.isModified = false;
      tab.originalContent = tab.content;
    } catch (e) {
      console.error("保存知识库文件失败:", e);
    }
  }
}

function proceedBackToEditor() {
  modeTransition.value = "closing";
  appMode.value = "editor";
  kbCloseCurrentTab();
  nextTick().then(() => {
    setTimeout(() => {
      modeTransition.value = "opening";
      if (tabs.value.length === 0) {
        closeAllTabs();
      }
      notifyModeChange("editor");
    }, 200);
  });
}

// 修改backToEditor为handleCloseKbConfirm
async function backToEditor() {
  await handleCloseKbConfirm();
}

watch(isShowOutline, async (val) => {
  if (val) {
    outlineState.value = "opening";
  } else {
    // 先瞬间切回 transform 定位（视觉位置不变，无动画）
    outlineState.value = "closing-prep";
    await nextTick();
    editorAreaRef.value?.offsetHeight; // 强制浏览器应用样式
    kbEditorAreaRef.value?.offsetHeight; // 同时处理知识库模式的区域
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
    kbEditorAreaRef.value?.offsetHeight; // 同时处理知识库模式的区域
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
    kbEditorAreaRef.value?.offsetHeight; // 同时处理知识库模式的区域
    aiChatFullscreenStateInternal.value = "opening";
  } else {
    // 关闭全屏
    aiChatFullscreenStateInternal.value = "closing-prep";
    await nextTick();
    editorAreaRef.value?.offsetHeight; // 强制浏览器应用样式
    kbEditorAreaRef.value?.offsetHeight; // 同时处理知识库模式的区域
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

  emitter.on("kb:toggle", handleToggleMode);
  emitter.on("kb:go-to-list", goToKnowledgeBase);
  emitter.on("kb:back-to-editor", backToEditor);
  emitter.on("kb:open-kb", (kb: KnowledgeBaseInfo) => {
    currentKb.value = kb;
    kbView.value = "view";
  });
  emitter.on("kb:back-to-list", async () => {
    // 检查知识库未保存文件
    if (kbCurrentTab.value && kbCurrentTab.value.isModified) {
      const result = await showDialog(kbCurrentTab.value.name);
      if (result === "cancel") return;
      if (result === "save") await kbSaveCurrentFile();
    }
    // 关闭知识库的文件，清空状态
    kbCloseCurrentTab();
    currentKb.value = null;
    kbView.value = "list";
  });
  emitter.on("kb:open-file", async (filePath: string) => {
    if (appMode.value !== "knowledgeBase") return;
    await kbOpenFile(filePath);
  });
  // 知识库保存当前文件
  emitter.on("kb:save-current", kbSaveCurrentFile);
  // 监听主菜单保存事件
  window.electronAPI.on("menu-save", async () => {
    if (appMode.value === "knowledgeBase") {
      await kbSaveCurrentFile();
    } else {
      await saveCurrentTab();
    }
  });
  emitter.on("trigger-save", async (_: any) => {
    if (appMode.value === "knowledgeBase") {
      await kbSaveCurrentFile();
    } else {
      await saveCurrentTab();
    }
  });

  emitter.on("kb:sidebar-toggle", toggleKBSidebar);
  emitter.on("global:toggle-outline", () => {
    if (appMode.value === "knowledgeBase") {
      kbIsShowOutline.value = !kbIsShowOutline.value;
    } else {
      toggleShowOutline();
    }
  });
  emitter.on("global:toggle-ai-chat", () => {
    if (appMode.value === "knowledgeBase") {
      kbIsShowAIChat.value = !kbIsShowAIChat.value;
    } else {
      toggleAIChatSidebar();
    }
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

  // 处理保存快捷键，两种模式都能响应
  window.electronAPI.on("file:save", async () => {
    if (appMode.value === "knowledgeBase") {
      await kbSaveCurrentFile();
    } else {
      await saveCurrentTab();
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
  // 先检查当前模式，如果是知识库模式，先检查知识库的未保存文件
  if (appMode.value === "knowledgeBase") {
    const kbUnsavedTabs = getKbUnsavedTabs();
    
    // 逐个处理知识库的未保存文件
    for (let i = 0; i < kbUnsavedTabs.length; i++) {
      const tab = kbUnsavedTabs[i];
      kbActiveTabId.value = tab.id;
      emitter.emit("kb:tab-updated", tab);
      
      const result = await showDialog(tab.name);
      if (result === "cancel") {
        return;
      }
      if (result === "save") {
        try {
          await window.electronAPI.saveFile(tab.filePath!, tab.content);
          tab.isModified = false;
          tab.originalContent = tab.content;
        } catch (e) {
          console.error("保存知识库文件失败:", e);
        }
      }
    }
  }

  // 再检查编辑器模式的未保存文件
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
      </div>

      <div class="knowledgeBase-mode-container">
        <template v-if="kbView === 'view' && currentKb">
          <div id="fontRoot">
            <div class="kb-layout">
              <div class="kb-sidebar-wrapper" :class="{ collapsed: !isShowKBSidebar }">
                <KnowledgeBaseView
                :kb-path="currentKb.path"
                :kb-name="currentKb.name"
                :kb-description="currentKb.description ?? ''"
                :kb-current-tab="kbCurrentTab"
                :kb-tabs="kbTabs"
              />
              </div>
              <div ref="kbEditorAreaRef" class="editorArea" :class="[kbOutlineClass, kbAIChatSidebarClass, kbAIChatFullscreenClass]">
                <div class="outlineBox">
                  <Outline />
                </div>
                <div class="editorBox">
                  <MarbymarkdownEditor
                    v-for="tab in kbTabs"
                    :key="tab.id"
                    v-show="tab.id === kbActiveTabId"
                    :tab="tab"
                    :is-active="tab.id === kbActiveTabId"
                  />
                  <div v-if="kbTabs.length === 0 && !kbFileLoading" class="kb-welcome-screen">
                    <div class="kb-welcome-content">
                      <h2 class="kb-welcome-title">欢迎来到 {{ currentKb.name }}</h2>
                      <p class="kb-welcome-desc">请从左侧知识库侧边栏选择文件，或创建新文件开始编辑</p>
                    </div>
                  </div>
                </div>
                <div class="aiChatSidebarBox">
                  <AIChatSidebar />
                </div>
              </div>
            </div>
          </div>
        </template>
        <KnowledgeBaseList v-else />
      </div>
    </div>
    <StatusBar
      :content="(appMode === 'knowledgeBase' ? kbCurrentTab : currentTab)?.content ?? ''"
      :kb-current-tab="kbCurrentTab"
      :is-knowledge-base="appMode === 'knowledgeBase'"
    />
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
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-height: 0;
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

/* 知识库模式布局 */
.kb-layout {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.kb-layout .editorArea {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.kb-sidebar-wrapper {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-color-3);
  border-right: 1px solid var(--border-color-1);
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.kb-sidebar-wrapper.collapsed {
  width: 0;
  border-right: none;
}

.kb-welcome-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background-color);
}

.kb-welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.kb-welcome-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color);
}

.kb-welcome-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-color-3);
}
</style>
