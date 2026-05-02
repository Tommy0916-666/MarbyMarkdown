<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import AIGlobalSetting from "./AIGlobalSetting.vue";
import AISetting from "./AISetting.vue";
import AIChatSetting from "./AIChatSetting.vue";
import AIOptimizeSetting from "./AIOptimizeSetting.vue";
import SoundscapeSetting from "./SoundscapeSetting.vue";

const aiCategoryExpanded = ref(true);

function toggleAICategory() {
  aiCategoryExpanded.value = !aiCategoryExpanded.value;
}
</script>

<template>
  <div class="ExtensionSettingsBox">
    <!-- 声景模块 -->
    <SoundscapeSetting />
    
    <div class="section-divider" />
    
    <!-- AI Related Functions -->
    <div class="category-container">
      <div class="category-header" @click="toggleAICategory">
        <span class="category-icon-badge">
          <AppIcon name="magic-wand" />
        </span>
        <div class="category-title-group">
          <h2 class="category-title">AI 相关功能</h2>
          <span class="category-desc">AI 续写、聊天、优化等功能</span>
        </div>
        <span class="expand-icon" :class="{ expanded: aiCategoryExpanded }">
          <AppIcon name="arrow-right" />
        </span>
      </div>

      <div v-if="aiCategoryExpanded" class="category-content">
        <!-- Global AI Config - First Item -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge global">
              <AppIcon name="ai-global" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">全局 AI 配置</h3>
              <span class="sub-desc">所有 AI 功能的默认配置</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <AIGlobalSetting />
          </div>
        </div>

        <!-- Divider -->
        <div class="sub-divider" />

        <!-- AI Continue Setting -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge">
              <AppIcon name="edit" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">AI 续写设置</h3>
              <span class="sub-desc">配置 AI 文本续写功能</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <AISetting />
          </div>
        </div>

        <!-- AI Chat Setting -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge">
              <AppIcon name="ai-chat" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">AI 聊天设置</h3>
              <span class="sub-desc">配置基于当前文件的 AI 对话</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <AIChatSetting />
          </div>
        </div>

        <!-- AI Optimize Setting -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge">
              <AppIcon name="ai-optimize" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">AI 优化设置</h3>
              <span class="sub-desc">配置选中文本的 AI 优化功能</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <AIOptimizeSetting />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.ExtensionSettingsBox {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 10px 200px;
  box-sizing: border-box;
  gap: 20px;
  max-width: 800px;

  .section-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-color-2), transparent);
    margin: 10px 0;
  }

  .category-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: background 0.2s;

    &:hover {
      background: var(--hover-background-color);
    }

    .category-icon-badge {
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

    .category-title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .category-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--text-color);
      margin: 0;
    }

    .category-desc {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-color-2);
    }

    .expand-icon {
      font-size: 16px;
      color: var(--text-color-3);
      transition: transform 0.2s;
      flex-shrink: 0;

      &.expanded {
        transform: rotate(90deg);
      }
    }
  }

  .category-content {
    padding-left: 54px;
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .sub-divider {
    height: 1px;
    background: var(--border-color-1);
    margin: 0 0 20px 0;
  }

  .sub-setting-item {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
  }

  .sub-setting-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .sub-title-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    flex-shrink: 0;
    color: var(--text-color-2);
    background: color-mix(in srgb, var(--text-color-2) 10%, transparent);
    font-size: 16px;

    &.global {
      color: #10b981;
      background: color-mix(in srgb, #10b981 14%, transparent);
    }
  }

  .sub-title-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .sub-title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-color);
    margin: 0;
  }

  .sub-desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-color-2);
  }

  .sub-setting-content {
    padding-left: 50px;
  }
}

@media (max-width: 768px) {
  .ExtensionSettingsBox {
    padding: 0 10px 160px;

    .category-content {
      padding-left: 0;
    }

    .sub-setting-content {
      padding-left: 0;
    }
  }
}
</style>
