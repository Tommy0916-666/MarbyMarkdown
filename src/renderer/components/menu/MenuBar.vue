<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import About from "@/renderer/components/settings/About.vue";
import appearancePage from "@/renderer/components/settings/AppearancePage.vue";
import FileOptions from "@/renderer/components/settings/FileOptions.vue";
import Guide from "@/renderer/components/settings/Guide.vue";
import Language from "@/renderer/components/settings/Language.vue";
import SettingBase from "@/renderer/components/settings/SettingBase.vue";
import ShortcutPage from "@/renderer/components/settings/ShortcutPage.vue";
import ExtensionSettings from "@/renderer/components/settings/ExtensionSettings.vue";
import KnowledgeBaseSetting from "@/renderer/components/settings/KnowledgeBaseSetting.vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import emitter from "@/renderer/events";
import { checkUpdate } from "@/renderer/services/api/update.js";

const activeTab = ref<"settings" | "about" | "appearance" | "file" | "language" | "shortcut" | "guide" | "extension" | "knowledgeBase">(
  "file"
);

// 当前应用模式
const appMode = ref<"editor" | "knowledgeBase">("editor");

// 监听模式变化
emitter.on("app:mode-change", (mode: "editor" | "knowledgeBase") => {
  appMode.value = mode;
});

// 监听设置打开事件，根据当前模式设置默认页面
emitter.on("settings:open", () => {
  if (appMode.value === "knowledgeBase") {
    activeTab.value = "knowledgeBase";
  }
});
const MenuComponents = {
  settings: SettingBase,
  about: About,
  language: Language,
  appearance: appearancePage,
  file: FileOptions,
  shortcut: ShortcutPage,
  guide: Guide,
  extension: ExtensionSettings,
  knowledgeBase: KnowledgeBaseSetting,
};

// 处理跳转到拓展功能页面的事件
function handleGoToExtension() {
  activeTab.value = "extension";
}

onMounted(() => {
  emitter.on("settings:go-to-extension", handleGoToExtension);
});

onUnmounted(() => {
  emitter.off("settings:go-to-extension", handleGoToExtension);
});
const MenuOptions = [
  { label: "文件", action: () => (activeTab.value = "file"), icon: "document", value: "file" },
  {
    label: "设置",
    action: () => (activeTab.value = "settings"),
    icon: "config-props",
    value: "settings",
  },
  {
    label: "拓展功能",
    action: () => (activeTab.value = "extension"),
    icon: "extension",
    value: "extension",
  },
  {
    label: "知识库",
    action: () => (activeTab.value = "knowledgeBase"),
    icon: "library",
    value: "knowledgeBase",
  },
  {
    label: "外观",
    action: () => (activeTab.value = "appearance"),
    icon: "waiguan",
    value: "appearance",
  },
  {
    label: "快捷键",
    action: () => (activeTab.value = "shortcut"),
    icon: "shortcut-key",
    value: "shortcut",
  },
  {
    label: "语言",
    action: () => (activeTab.value = "language"),
    icon: "fanyi",
    value: "language",
  },
  { label: "说明与指南", action: () => (activeTab.value = "guide"), icon: "book-open", value: "guide" },
  { label: "关于", action: () => (activeTab.value = "about"), icon: "github", value: "about" },
];
checkUpdate().then((updateInfo) => {
  if (updateInfo) {
    emitter.emit("update:available", updateInfo);
  }
});
</script>

<template>
  <div class="MenubarBox">
    <div class="optionsContainer">
      <button
        v-for="option in MenuOptions"
        :key="option.label"
        class="menu-option"
        :class="{ active: activeTab === option.value }"
        @click="option.action"
      >
        <AppIcon :name="option.icon" class="menu-option-icon" />
        {{ option.label }}
      </button>
    </div>
    <div class="detailContainer">
      <div class="scrollView">
        <div class="components">
          <component :is="MenuComponents[activeTab]" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.MenubarBox {
  height: 100%;
  display: flex;

  .detailContainer {
    flex: 1;
    height: calc(100% - 24px);
    padding: 12px;
    padding-top: 0;
    padding-right: 0;
    background: var(--background-color-2);

    .scrollView {
      height: 100%;
      overflow-y: auto;
      background: var(--background-color-2);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .components {
      height: 100%;
      padding-top: 12px;
    }
  }

  .optionsContainer {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 12px 0;
    width: 200px;
    gap: 4px;
    -webkit-app-region: drag;
    background: var(--background-color);

    .menu-option {
      cursor: pointer;
      width: 100%;
      -webkit-app-region: no-drag;
      padding: 16px 12px;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: transparent;
      text-align: left;
      color: var(--text-color);

      .menu-option-icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      &:hover {
        background: var(--hover-color);
      }

      &.active {
        background: var(--active-color);
        font-weight: bold;
      }
    }
  }
}
</style>
