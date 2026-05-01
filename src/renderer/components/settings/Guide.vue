<script setup lang="ts">
import { ref, onMounted, reactive, nextTick } from "vue";
import { createMilkupEditor } from "@/core/index";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";

// 使用声明 electronAPI
declare global {
  interface Window {
    electronAPI: {
      readGuideFile: () => Promise<string>;
    };
  }
}

const containerRef = ref<HTMLElement | null>(null);
const scrollViewRef = ref<HTMLElement | null>(null);
const editor = ref<any>(null);
const outline = ref<Array<{ level: number; text: string; id: string; pos: number }>>([]);
const drawerOpen = ref(false);
const guideContent = ref<string>("");
const isLoading = ref(true);

const collapsedSet = reactive(new Set<string>());

function isHiddenByCollapse(index: number): boolean {
  const items = outline.value;
  let targetLevel = items[index].level;
  for (let i = index - 1; i >= 0; i--) {
    if (items[i].level < targetLevel) {
      if (collapsedSet.has(items[i].id)) {
        return true;
      }
      targetLevel = items[i].level;
    }
  }
  return false;
}

function hasChildren(index: number): boolean {
  const items = outline.value;
  const currentLevel = items[index].level;
  return index + 1 < items.length && items[index + 1].level > currentLevel;
}

function toggleCollapse(oi: { id: string }) {
  if (collapsedSet.has(oi.id)) {
    collapsedSet.delete(oi.id);
  } else {
    collapsedSet.add(oi.id);
  }
}

function onOiClick(oi: { id: string; text: string; level: number; pos: number }, index: number) {
  if (!scrollViewRef.value) return;

  const headings = scrollViewRef.value.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (headings[index]) {
    const rect = headings[index].getBoundingClientRect();
    const scrollViewRect = scrollViewRef.value.getBoundingClientRect();
    const scrollTop = scrollViewRef.value.scrollTop + rect.top - scrollViewRect.top;
    
    scrollViewRef.value.scrollTo({
      top: scrollTop,
      behavior: "smooth",
    });
  }
}

async function loadGuideContent() {
  try {
    if (window.electronAPI && window.electronAPI.readGuideFile) {
      guideContent.value = await window.electronAPI.readGuideFile();
    } else {
      guideContent.value = "# MarbyMarkdown 使用指南\n\n无法读取文档，请检查配置。";
    }
  } catch (error) {
    console.error("[Guide] 读取文档失败:", error);
    guideContent.value = "# MarbyMarkdown 使用指南\n\n读取文档失败，请检查 GUIDE.md 是否存在。";
  }
  isLoading.value = false;
}

onMounted(async () => {
  await loadGuideContent();
  await nextTick();
  
  if (!containerRef.value) return;

  const config = {
    content: guideContent.value,
    readonly: true,
    placeholder: "",
  };

  editor.value = createMilkupEditor(containerRef.value, config);
  extractOutline();
});

function extractOutline() {
  if (!editor.value) return;
  const doc = editor.value.getDoc();
  const headings: Array<{ level: number; text: string; id: string; pos: number }> = [];

  doc.descendants((node: any, nodePos: number) => {
    if (node.type.name === "heading") {
      let text = "";
      node.forEach((child: any) => {
        if (child.isText && !child.marks.some((m: any) => m.type.name === "syntax_marker")) {
          text += child.text || "";
        }
      });
      if (text.trim()) {
        headings.push({
          level: node.attrs.level,
          text: text.trim(),
          id: `guide-heading-${nodePos}`,
          pos: nodePos,
        });
      }
    }
    return true;
  });

  outline.value = headings;
}
</script>

<template>
  <div class="guide-box">
    <!-- 悬浮大纲按钮 -->
    <div class="outline-toggle-btn" @click="drawerOpen = !drawerOpen">
      <AppIcon name="List-outlined" />
    </div>

    <!-- 悬浮抽屉 -->
    <div class="drawer-overlay" v-if="drawerOpen" @click="drawerOpen = false"></div>
    <div class="outline-drawer" :class="{ open: drawerOpen }">
      <div class="drawer-header">
        <AppIcon name="List-outlined" class="drawer-icon" />
        <span class="drawer-title">大纲</span>
        <div class="drawer-close" @click="drawerOpen = false">
          <AppIcon name="close" />
        </div>
      </div>
      <div class="drawer-content">
        <div v-if="outline.length > 0" class="outlineItems">
          <template v-for="(oi, index) in outline" :key="oi.id">
            <div
              v-if="!isHiddenByCollapse(index)"
              class="outlineItem"
              :style="{ paddingLeft: `${(oi.level - 1) * 16 + 8}px` }"
              @click="onOiClick(oi, index); drawerOpen = false"
            >
              <span
                v-if="hasChildren(index)"
                class="collapse-icon"
                :class="{ collapsed: collapsedSet.has(oi.id) }"
                @click.stop="toggleCollapse(oi)"
              >
                <AppIcon name="arrow-right" />
              </span>
              <span v-else class="collapse-icon-placeholder"></span>
              <span class="outlineItem-text">{{ oi.text }}</span>
            </div>
          </template>
        </div>
        <div v-else class="empty-state">
          <AppIcon name="List-outlined" class="empty-icon" />
          <span class="empty-text">暂无大纲</span>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-panel">
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <span class="loading-text">加载文档中...</span>
      </div>
      <div v-else class="scrollView marbymarkdown" ref="scrollViewRef">
        <div ref="containerRef" class="marbymarkdown-container"></div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.guide-box {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
}

// 加载动画
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-color-3);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color-1);
  border-top-color: var(--text-color-1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
}

/* 悬浮大纲按钮 */
.outline-toggle-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--background-color-2);
  border: 1px solid var(--border-color-1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  color: var(--text-color-2);
}
.outline-toggle-btn:hover {
  background: var(--hover-background-color);
  color: var(--text-color-1);
  transform: scale(1.05);
}
/* 抽屉遮罩 */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 99;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
/* 抽屉 */
.outline-drawer {
  position: absolute;
  top: 0;
  left: 0;
  width: 260px;
  height: 100%;
  background: var(--background-color-2);
  border-right: 1px solid var(--border-color-1);
  z-index: 100;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}
.outline-drawer.open {
  transform: translateX(0);
}
.outline-drawer .drawer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-1);
  border-bottom: 1px solid var(--border-color-1);
}
.outline-drawer .drawer-header .drawer-icon {
  font-size: 18px;
}
.outline-drawer .drawer-header .drawer-title {
  flex: 1;
}
.outline-drawer .drawer-header .drawer-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
  color: var(--text-color-3);
}
.outline-drawer .drawer-header .drawer-close:hover {
  background: var(--hover-background-color);
  color: var(--text-color-1);
}
.outline-drawer .drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.outline-drawer .outlineItems {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.outline-drawer .outlineItem {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px 6px 8px;
  cursor: pointer;
  transition: background 0.15s ease;
  color: var(--text-color-2);
  font-size: 13px;
}
.outline-drawer .outlineItem:hover {
  background: var(--hover-background-color);
  color: var(--text-color-1);
}
.outline-drawer .outlineItem .collapse-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-color-3);
  transition: transform 0.2s ease;
}
.outline-drawer .outlineItem .collapse-icon.collapsed {
  transform: rotate(-90deg);
}
.outline-drawer .outlineItem .collapse-icon-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.outline-drawer .outlineItem .outlineItem-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.outline-drawer .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  color: var(--text-color-3);
  font-size: 13px;
}
.outline-drawer .empty-state .empty-icon {
  font-size: 28px;
  opacity: 0.5;
}
.content-panel {
  flex: 1;
  overflow: hidden;
}
.scrollView {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--background-color-1);
  padding: 32px 64px;
  box-sizing: border-box;
}
.marbymarkdown-container {
  width: 100%;
  min-height: 100%;
}
</style>
