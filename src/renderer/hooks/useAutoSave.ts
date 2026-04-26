import { computed, onUnmounted, ref, watch } from "vue";
import { useConfig } from "./useConfig";
import useTab from "./useTab";
import emitter from "@/renderer/events";

// 单例状态，这样所有调用 useAutoSave 的地方都共享同一个实例
let autoSaveState: {
  autoSaveTimer: number | null;
  lastAutoSaveTime: number | null;
  isAutoSaveActive: boolean;
  isSaving: boolean;
} = {
  autoSaveTimer: null,
  lastAutoSaveTime: null,
  isAutoSaveActive: false,
  isSaving: false,
};

let initialized = false;

export default function useAutoSave() {
  const { config, setConf } = useConfig();
  const { saveCurrentTab, currentTab, tabs } = useTab();

  const autoSaveConfig = computed(() => config.value.autoSave);

  // 将 ref 绑定到单例状态上
  const autoSaveTimer = ref(autoSaveState.autoSaveTimer);
  const lastAutoSaveTime = ref(autoSaveState.lastAutoSaveTime);
  const isAutoSaveActive = ref(autoSaveState.isAutoSaveActive);
  const isSaving = ref(autoSaveState.isSaving);

  // 同步单例状态到本地 ref
  watch(isAutoSaveActive, (newVal) => {
    autoSaveState.isAutoSaveActive = newVal;
  });
  watch(isSaving, (newVal) => {
    autoSaveState.isSaving = newVal;
  });
  watch(autoSaveTimer, (newVal) => {
    autoSaveState.autoSaveTimer = newVal;
  });
  watch(lastAutoSaveTime, (newVal) => {
    autoSaveState.lastAutoSaveTime = newVal;
  });

  function startAutoSave() {
    if (!autoSaveConfig.value.enabled) return;
    if (autoSaveTimer.value) return;

    autoSaveTimer.value = window.setInterval(() => {
      performAutoSave();
    }, autoSaveConfig.value.saveInterval);
    isAutoSaveActive.value = true;
  }

  function stopAutoSave() {
    if (autoSaveTimer.value) {
      clearInterval(autoSaveTimer.value);
      autoSaveTimer.value = null;
    }
    isAutoSaveActive.value = false;
  }

  async function performAutoSave() {
    if (!autoSaveConfig.value.enabled) { return; }
    if (!currentTab.value?.isModified) { return; }
    if (!currentTab.value?.filePath) {
      // 文件还没保存，但必须先写了内容才会弹窗
      if (autoSaveConfig.value.enablePrompt) {
        emitter.emit("autoSave:needSavePrompt");
      }
      return;
    }

    // 显示保存中
    isSaving.value = true;

    // 保存当前 tab 的自动保存前的内容（用于回滚）到临时文件
    if (autoSaveConfig.value.enableRollback && currentTab.value.filePath) {
      await window.electronAPI.saveRollbackTemp(currentTab.value.filePath, currentTab.value.originalContent);
    }

    const saved = await saveCurrentTab(true);

    // 保存完成，立即停止动画
    isSaving.value = false;

    if (saved) {
      lastAutoSaveTime.value = Date.now();
      emitter.emit("autoSave:performed");
    }
  }

  async function triggerManualSave() {
    isSaving.value = true;

    const saved = await saveCurrentTab(false);

    // 保存完成，立即停止动画
    isSaving.value = false;

    if (saved) {
      lastAutoSaveTime.value = Date.now();
      manualSavePerformed();
    }
  }

  async function hasRollbackContent(filePath: string | null): Promise<boolean> {
    if (!filePath) return false;
    const content = await window.electronAPI.loadRollbackTemp(filePath);
    return !!content;
  }

  async function getRollbackContent(filePath: string | null): Promise<string | null> {
    if (!filePath) return null;
    return window.electronAPI.loadRollbackTemp(filePath);
  }

  async function clearRollbackContent(filePath: string | null) {
    if (!filePath) return;
    await window.electronAPI.deleteRollbackTemp(filePath);
  }

  async function manualSavePerformed() {
    // 手动保存时，清空对应的自动保存回滚内容
    if (currentTab.value?.filePath) {
      await clearRollbackContent(currentTab.value.filePath);
      emitter.emit("autoSave:performed"); // 通知 UI 更新回滚状态
    }
    lastAutoSaveTime.value = Date.now();
  }

  // 只初始化一次监听
  if (!initialized) {
    initialized = true;
    
    // 监听自动保存配置变化
    watch(
      () => autoSaveConfig.value.enabled,
      (newVal) => {
        if (newVal) {
          startAutoSave();
        } else {
          stopAutoSave();
        }
      },
      { immediate: true }
    );

    // 监听保存间隔变化，重启定时器
    watch(
      () => autoSaveConfig.value.saveInterval,
      () => {
        if (autoSaveConfig.value.enabled) {
          stopAutoSave();
          startAutoSave();
        }
      }
    );
  }

  return {
    autoSaveConfig,
    lastAutoSaveTime,
    isAutoSaveActive,
    isSaving,
    startAutoSave,
    stopAutoSave,
    performAutoSave,
    hasRollbackContent,
    getRollbackContent,
    clearRollbackContent,
    manualSavePerformed,
    triggerManualSave,
  };
}
