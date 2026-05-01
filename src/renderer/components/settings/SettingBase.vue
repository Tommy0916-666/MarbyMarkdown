<script setup lang="ts">
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import ImageConfig from "./ImageConfig.vue";
import SpellCheckSetter from "./SpellCheckSetter.vue";
import WorkspaceSetting from "./WorkspaceSetting.vue";
import { Input } from "@/renderer/components/ui/input";
import { Switch } from "@/renderer/components/ui/switch";
import { useConfig } from "@/renderer/hooks/useConfig";
import { computed, ref } from "vue";

const { config, setConf } = useConfig();

// 最近文件设置相关
const recentFilesSettingsExpanded = ref(false);
function toggleRecentFilesSettings() {
  recentFilesSettingsExpanded.value = !recentFilesSettingsExpanded.value;
}
function setRecentFilesEnabled(enabled: boolean) {
  setConf("recentFiles", { ...config.value.recentFiles, enabled });
}
function setMaxRecentFiles(value: string) {
  const num = parseInt(value, 10);
  if (!isNaN(num) && num > 0) {
    setConf("recentFiles", { ...config.value.recentFiles, maxFiles: num });
  }
}

// 自动保存设置相关
const autoSaveSettingsExpanded = ref(false);
function toggleAutoSaveSettings() {
  autoSaveSettingsExpanded.value = !autoSaveSettingsExpanded.value;
}
function setAutoSaveEnabled(enabled: boolean) {
  setConf("autoSave", { ...config.value.autoSave, enabled });
}
function setRollbackEnabled(enabled: boolean) {
  setConf("autoSave", { ...config.value.autoSave, enableRollback: enabled });
}

function setPromptEnabled(enabled: boolean) {
  setConf("autoSave", { ...config.value.autoSave, enablePrompt: enabled });
}
function setAutoSaveInterval(value: string) {
  const num = parseInt(value, 10);
  if (!isNaN(num) && num > 0) {
    setConf("autoSave", { ...config.value.autoSave, saveInterval: num * 1000 });
  }
}

const settingSections = [
  {
    title: "最近文件",
    desc: "配置最近打开文件的记录功能",
    icon: "document",
    component: "recent-files",
  },
  {
    title: "自动保存",
    desc: "自动定时保存文件，防止未保存的修改丢失",
    icon: "refresh",
    component: "auto-save",
  },
  {
    title: "拼写检查",
    desc: "控制编辑器中的拼写检查能力",
    icon: "check-circle",
    component: SpellCheckSetter,
  },
  {
    title: "图片粘贴",
    desc: "设置粘贴图片后的保存与上传方式",
    icon: "image-config",
    component: ImageConfig,
  },
  {
    title: "工作区",
    desc: "设置启动时自动打开的文件夹与左侧边栏状态",
    icon: "folder-opened",
    component: WorkspaceSetting,
  },
] as const;
</script>

<template>
  <div class="SettingBaseBox">
    <div v-for="section in settingSections" :key="section.title" class="settingItem">
      <div class="settingHeader">
        <span class="titleBadge">
          <AppIcon :name="section.icon" />
        </span>
        <div class="titleGroup">
          <h2 class="title">{{ section.title }}</h2>
          <span class="desc">{{ section.desc }}</span>
        </div>
      </div>
      <div class="settingContent">
        <!-- 最近文件设置 -->
        <div v-if="section.component === 'recent-files'" class="custom-setting">
          <div class="setting-item">
            <label class="setting-label">启用最近文件</label>
            <div class="setting-input-wrapper">
              <Switch
                :model-value="config.recentFiles?.enabled ?? true"
                @update:model-value="setRecentFilesEnabled"
              />
            </div>
          </div>
          <div class="setting-item">
            <label class="setting-label">最大记录数量</label>
            <div class="setting-input-wrapper">
              <Input
                type="number"
                :model-value="config.recentFiles?.maxFiles?.toString() ?? '10'"
                placeholder="请输入数字"
                @update:model-value="setMaxRecentFiles"
              />
            </div>
          </div>
        </div>

        <!-- 自动保存设置 -->
        <div v-else-if="section.component === 'auto-save'" class="custom-setting">
          <div class="setting-item">
            <label class="setting-label">启用自动保存</label>
            <div class="setting-input-wrapper">
              <Switch
                :model-value="config.autoSave?.enabled ?? true"
                @update:model-value="setAutoSaveEnabled"
              />
            </div>
          </div>
          <div class="setting-item">
            <label class="setting-label">保存间隔(秒)</label>
            <div class="setting-input-wrapper">
              <Input
                type="number"
                :model-value="((config.autoSave?.saveInterval ?? 30000) / 1000).toString()"
                placeholder="请输入数字"
                @update:model-value="setAutoSaveInterval"
              />
            </div>
          </div>
          <div class="setting-item">
            <label class="setting-label">启用回退功能</label>
            <div class="setting-input-wrapper">
              <Switch
                :model-value="config.autoSave?.enableRollback ?? true"
                @update:model-value="setRollbackEnabled"
              />
            </div>
          </div>
          <div class="setting-item">
            <label class="setting-label">启用提示弹窗</label>
            <div class="setting-input-wrapper">
              <Switch
                :model-value="config.autoSave?.enablePrompt ?? true"
                @update:model-value="setPromptEnabled"
              />
            </div>
          </div>
        </div>

        <!-- 其他组件 -->
        <component v-else :is="section.component" />
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.SettingBaseBox {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 10px 200px;
  box-sizing: border-box;
  gap: 40px;
  max-width: 800px;

  .settingItem {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;

    .settingHeader {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }

    .titleBadge {
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

    .titleGroup {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--text-color);
      margin: 0;
    }

    .desc {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-color-2);
    }

    .settingContent {
      padding-left: 54px;
    }
  }

  // 自定义设置样式
  .custom-setting {
    display: flex;
    flex-direction: column;
    gap: 16px;

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

      .setting-input-wrapper {
        padding-top: 8px;
      }
    }
  }
}

@media (max-width: 768px) {
  .SettingBaseBox {
    padding: 0 10px 160px;

    .settingItem {
      .settingContent {
        padding-left: 0;
      }
    }

    .custom-setting {
      .setting-item {
        flex-direction: column;
        gap: 8px;

        .setting-label {
          min-width: auto;
          padding-top: 0;
        }

        .setting-input-wrapper {
          padding-top: 0;
        }
      }
    }
  }
}
</style>
