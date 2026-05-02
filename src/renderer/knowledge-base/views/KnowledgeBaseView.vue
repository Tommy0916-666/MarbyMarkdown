<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, reactive } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import emitter from "@/renderer/events";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  mtime?: number;
  children?: FileNode[];
}

const props = defineProps<{
  kbPath: string;
  kbName: string;
  kbDescription: string;
  kbCurrentTab?: any;
  kbTabs?: any[];
}>();

function isFileModified(path: string): boolean {
  if (!props.kbTabs || props.kbTabs.length === 0) return false;
  const tab = props.kbTabs.find(tab => tab.filePath === path);
  return tab?.isModified || false;
}

const kbOutline = ref<{ id: string; level: number; text: string; pos: number }[]>([]);
const kbCollapsedSet = reactive(new Set<string>());

function isKbHiddenByCollapse(index: number): boolean {
  const items = kbOutline.value;
  let targetLevel = items[index].level;
  for (let i = index - 1; i >= 0; i--) {
    if (items[i].level < targetLevel) {
      if (kbCollapsedSet.has(items[i].id)) {
        return true;
      }
      targetLevel = items[i].level;
    }
  }
  return false;
}

function hasKbChildren(index: number): boolean {
  const items = kbOutline.value;
  const currentLevel = items[index].level;
  return index + 1 < items.length && items[index + 1].level > currentLevel;
}

function toggleKbCollapse(oi: { id: string }) {
  if (kbCollapsedSet.has(oi.id)) {
    kbCollapsedSet.delete(oi.id);
  } else {
    kbCollapsedSet.add(oi.id);
  }
}

function onKbOutlineClick(oi: { id: string; text: string; level: number; pos: number }) {
  emitter.emit("outline:scrollTo", oi.pos);
}

function setKbOutline(headings: any) {
  kbOutline.value = headings;
}

const activeTab = ref<"files" | "outline">("files");
const loading = ref(true);
const fileTree = ref<FileNode[]>([]);
const expandedDirs = ref<Set<string>>(new Set());
const selectedFile = ref<string | null>(null);
const showCreateDialog = ref(false);
const newFileName = ref("");
const creating = ref(false);
const createError = ref("");
const descExpanded = ref(false);

function toggleDir(path: string) {
  if (expandedDirs.value.has(path)) {
    expandedDirs.value.delete(path);
  } else {
    expandedDirs.value.add(path);
  }
}

function openFile(fileNode: FileNode) {
  if (fileNode.isDirectory) {
    toggleDir(fileNode.path);
  } else {
    selectedFile.value = fileNode.path;
    emitter.emit("kb:open-file", fileNode.path);
  }
}

// 添加一个函数来检查文件是否已打开
function isFileOpened(filePath: string) {
  return props.kbTabs?.some(tab => tab.filePath === filePath) || false;
}

function filterAIFolders(nodes: FileNode[]): FileNode[] {
  const aiFolders = new Set(['.index', 'assets', 'docs']);
  const aiFiles = new Set(['config.json', 'README.md']);

  return nodes.filter(node => {
    if (node.isDirectory && aiFolders.has(node.name)) {
      return false;
    }
    if (!node.isDirectory && aiFiles.has(node.name)) {
      return false;
    }
    if (node.children && node.children.length > 0) {
      node.children = filterAIFolders(node.children);
    }
    return true;
  });
}

async function loadFileTree() {
  loading.value = true;
  try {
    const files = await window.electronAPI.getDirectoryFiles(props.kbPath);
    if (files && files.length > 0) {
      fileTree.value = filterAIFolders(files);
    }
  } catch (e) {
    console.error("加载文件树失败:", e);
  } finally {
    loading.value = false;
  }
}

async function createDocument() {
  showCreateDialog.value = true;
  newFileName.value = "";
  createError.value = "";
}

async function confirmCreate() {
  let name = newFileName.value.trim();
  if (!name) {
    createError.value = "请输入文件名";
    return;
  }

  if (!name.endsWith(".md")) {
    name = name + ".md";
  }

  creating.value = true;
  createError.value = "";
  try {
    const filePath = await window.electronAPI.createFile(props.kbPath, name);
    if (filePath) {
      showCreateDialog.value = false;
      await loadFileTree();
      emitter.emit("kb:open-file", filePath);
    } else {
      createError.value = "创建文件失败，请重试";
    }
  } catch (e: any) {
    createError.value = e?.message || "创建文件失败";
  } finally {
    creating.value = false;
  }
}

function cancelCreate() {
  showCreateDialog.value = false;
  newFileName.value = "";
  createError.value = "";
}

function openFolder() {
  window.electronAPI.openKbPath(props.kbPath);
}

function saveCurrentFile() {
  emitter.emit("kb:save-current");
}

function closeKnowledgeBase() {
  emitter.emit("kb:back-to-list");
}

function toggleDesc() {
  descExpanded.value = !descExpanded.value;
}

const hasDescription = computed(() => (props.kbDescription ?? "").trim().length > 0);

onMounted(() => {
  loadFileTree();
  emitter.on("outline:Update", setKbOutline);
});

onUnmounted(() => {
  emitter.off("outline:Update", setKbOutline);
});

watch(() => props.kbPath, () => {
  loadFileTree();
});
</script>

<template>
  <div class="knowledge-base-view">
    <div class="kb-header">
      <div class="kb-title-row">
        <div class="kb-icon-box">
          <AppIcon name="library" />
        </div>
        <div class="kb-title-info">
          <span class="kb-name">{{ kbName }}</span>
          <button
            v-if="hasDescription"
            class="desc-toggle"
            :class="{ expanded: descExpanded }"
            @click="toggleDesc"
            :title="descExpanded ? '收起描述' : '展开描述'"
          >
            <AppIcon name="arrow-down" class="toggle-arrow" />
          </button>
        </div>
        <div class="kb-action-buttons">
          <button class="kb-save-btn" @click="saveCurrentFile" title="保存当前文件">
            <AppIcon name="check-circle" />
          </button>
          <button class="kb-close-btn" @click="closeKnowledgeBase" title="关闭知识库">
            <AppIcon name="close" />
          </button>
        </div>
      </div>
      <div v-if="hasDescription && descExpanded" class="kb-desc-panel">
        <p class="kb-desc-text">{{ kbDescription }}</p>
      </div>
    </div>

    <div class="tab-bar">
      <button
        class="tab-item"
        :class="{ active: activeTab === 'files' }"
        @click="activeTab = 'files'"
      >
        <AppIcon name="folder-opened" class="tab-icon" />
        文件
      </button>
      <button
        class="tab-item"
        :class="{ active: activeTab === 'outline' }"
        @click="activeTab = 'outline'"
      >
        <AppIcon name="List-outlined" class="tab-icon" />
        大纲
      </button>
    </div>

    <div class="actions-bar">
      <button class="action-btn" @click="createDocument">
        <AppIcon name="plus" />
        新建
      </button>
      <button class="action-btn" @click="openFolder">
        <AppIcon name="folder-opened" />
        打开
      </button>
    </div>

    <div v-if="activeTab === 'files'" class="tree-container">
      <div v-if="loading" class="tree-loading">
        <AppIcon name="loading" class="spinning" />
        加载中...
      </div>
      <div v-else class="file-tree">
    <template v-for="node in fileTree" :key="node.path">
      <div
        class="tree-item"
        :class="{
          selected: selectedFile === node.path,
          directory: node.isDirectory,
          opened: !node.isDirectory && isFileOpened(node.path)
        }"
        @click="openFile(node)"
      >
        <span class="expand-icon" v-if="node.isDirectory">
          <AppIcon v-if="expandedDirs.has(node.path)" name="arrow-down" />
          <AppIcon v-else name="arrow-right" />
        </span>
        <span class="empty-space" v-else></span>
        <span class="file-icon">
          <AppIcon v-if="node.isDirectory" name="folder-opened" />
          <AppIcon v-else name="document" />
        </span>
        <span class="file-name">
          {{ node.name }}
          <span v-if="isFileModified(node.path)" class="unsaved-star">*</span>
        </span>
      </div>
      <div v-if="node.isDirectory && expandedDirs.has(node.path)" class="child-tree">
        <template v-for="child in node.children" :key="child.path">
          <div
            class="tree-item"
            :class="{
              selected: selectedFile === child.path,
              directory: child.isDirectory,
              opened: !child.isDirectory && isFileOpened(child.path)
            }"
            @click="openFile(child)"
          >
            <span class="expand-icon" v-if="child.isDirectory">
              <AppIcon v-if="expandedDirs.has(child.path)" name="arrow-down" />
              <AppIcon v-else name="arrow-right" />
            </span>
            <span class="empty-space" v-else></span>
            <span class="file-icon">
              <AppIcon v-if="child.isDirectory" name="folder-opened" />
              <AppIcon v-else name="document" />
            </span>
            <span class="file-name">
              {{ child.name }}
              <span v-if="isFileModified(child.path)" class="unsaved-star">*</span>
            </span>
          </div>
        </template>
      </div>
    </template>
        <div v-if="fileTree.length === 0" class="tree-empty">
          暂无文件，点击"新建"创建一篇笔记吧
        </div>
      </div>
    </div>

    <div v-else class="outline-container">
      <div class="kb-outline">
        <div class="kb-outline-list">
          <template v-if="kbOutline.length > 0">
            <template v-for="(oi, index) in kbOutline" :key="oi.id">
              <div
                v-if="!isKbHiddenByCollapse(index)"
                class="kb-outline-item"
                :style="{ paddingLeft: `${oi.level * 12}px` }"
                @click="onKbOutlineClick(oi)"
              >
                <span
                  v-if="hasKbChildren(index)"
                  class="kb-collapse-icon"
                  :class="{ collapsed: kbCollapsedSet.has(oi.id) }"
                  @click.stop="toggleKbCollapse(oi)"
                >
                  <AppIcon name="arrow-right" />
                </span>
                <span v-else class="kb-collapse-icon-placeholder"></span>
                <span class="kb-outline-item-text">{{ oi.text }}</span>
              </div>
            </template>
          </template>
          <div v-else class="kb-outline-empty">
            <AppIcon name="List-outlined" class="kb-empty-icon" />
            <span class="kb-empty-text">暂无大纲</span>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCreateDialog" class="dialog-overlay" @click.self="cancelCreate">
        <div class="create-dialog" @keydown.escape="cancelCreate">
          <div class="dialog-header">
            <h3>新建文件</h3>
            <button class="close-btn" @click="cancelCreate">
              <AppIcon name="close" />
            </button>
          </div>
          <div class="dialog-body">
            <label class="input-label">文件名</label>
            <input
              v-model="newFileName"
              type="text"
              class="name-input"
              placeholder="例如：我的笔记"
              @keydown.enter="confirmCreate"
              autofocus
            />
            <p v-if="createError" class="error-text">{{ createError }}</p>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="cancelCreate">取消</button>
            <button class="confirm-btn" @click="confirmCreate" :disabled="creating">
              {{ creating ? "创建中..." : "创建" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="less">
.knowledge-base-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--background-color-2);
}

.kb-header {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border-color-1);
  background: var(--background-color-2);
  flex-shrink: 0;
}

.kb-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kb-action-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.kb-save-btn {
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
  font-size: 13px;
  transition: all 0.15s;
}

.kb-save-btn:hover {
  background: var(--hover-background-color);
  color: var(--primary-color);
}

.kb-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
  font-size: 13px;
  flex-shrink: 0;
}

.kb-title-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.kb-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desc-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color-3);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: color 0.15s;
}

.desc-toggle:hover {
  color: var(--text-color-1);
  background: var(--hover-background-color);
}

.desc-toggle.expanded .toggle-arrow {
  transform: rotate(180deg);
}

.toggle-arrow {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.kb-close-btn {
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
  flex-shrink: 0;
  font-size: 13px;
  transition: all 0.15s;
}

.kb-close-btn:hover {
  background: var(--hover-background-color);
  color: var(--text-color);
}

.kb-desc-panel {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-color-1) 40%, transparent);
  border: 1px solid var(--border-color-1);
}

.kb-desc-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-color-3);
  word-break: break-word;
}

.tab-bar {
  display: flex;
  width: 100%;
  background: var(--background-color-2);
  flex-shrink: 0;
}

.tab-item {
  flex: 1;
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
  border-bottom: 2px solid transparent;
  color: var(--text-color-3);
  background: transparent;
  border-top: none;
  border-left: none;
  border-right: none;
  outline: none;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.tab-item:hover {
  color: var(--text-color-2);
}

.tab-item.active {
  color: var(--text-color-1);
  font-weight: 600;
  position: relative;
}

.tab-item.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30%;
  height: 2px;
  background: var(--text-color-1);
  border-radius: 1px;
}

.tab-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.actions-bar {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color-1);
  background: var(--background-color-2);
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border-color-1);
  border-radius: 5px;
  background: var(--background-color);
  color: var(--text-color-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  border-color: var(--border-color-2);
  background: var(--hover-background-color);
  color: var(--text-color);
}

.tree-container,
.outline-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  background: var(--background-color-2);
}

.tree-container::-webkit-scrollbar,
.outline-container::-webkit-scrollbar {
  width: 4px;
}

.tree-container::-webkit-scrollbar-thumb,
.outline-container::-webkit-scrollbar-thumb {
  background: var(--border-color-2);
  border-radius: 2px;
}

.tree-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 20px;
  color: var(--text-color-3);
  font-size: 13px;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

.file-tree {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  cursor: pointer;
  transition: all 0.12s ease;
  font-size: 13px;
  color: var(--text-color-2);
}

.tree-item:hover {
  background: var(--hover-background-color);
  color: var(--text-color);
}

.tree-item.selected {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
}

.expand-icon,
.empty-space {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.file-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.file-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unsaved-star {
  color: var(--primary-color);
  font-weight: bold;
  margin-left: 2px;
}

.tree-item.opened {
  background-color: color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.child-tree {
  margin-left: 16px;
}

.tree-empty {
  padding: 20px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-color-3);
}

.kb-outline {
  width: 100%;
  height: 100%;
}

.kb-outline-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 4px;
}

.kb-outline-item {
  display: flex;
  align-items: center;
  width: 100%;
  color: var(--text-color-1);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.2s ease;
  padding: 4px 4px;
  border-radius: 4px;
  margin: 0 2px;
}

.kb-outline-item:hover {
  background: var(--hover-background-color);
}

.kb-collapse-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-right: 4px;
  transition: transform 0.2s;
  transform: rotate(90deg);
  color: var(--text-color-3);
  font-size: 10px;
  border-radius: 3px;
}

.kb-collapse-icon:hover {
  background: var(--hover-background-color);
}

.kb-collapse-icon.collapsed {
  transform: rotate(0deg);
}

.kb-collapse-icon-placeholder {
  display: inline-block;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-right: 4px;
}

.kb-outline-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.kb-outline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-color-3);
}

.kb-empty-icon {
  font-size: 32px;
  color: var(--text-color-3);
  opacity: 0.3;
}

.kb-empty-text {
  color: var(--text-color-3);
  font-size: 12px;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.create-dialog {
  width: 380px;
  background: var(--background-color-1);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color-1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-color-3);
  cursor: pointer;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--hover-background-color);
  color: var(--text-color);
}

.dialog-body {
  padding: 18px;
}

.input-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-color-2);
}

.name-input {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border-color-1);
  border-radius: 6px;
  background: var(--background-color);
  color: var(--text-color);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.name-input:focus {
  border-color: var(--primary-color);
}

.name-input::placeholder {
  color: var(--text-color-3);
}

.error-text {
  margin: 6px 0 0;
  font-size: 12px;
  color: #e53e3e;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color-1);
}

.cancel-btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border-color-1);
  border-radius: 6px;
  background: transparent;
  color: var(--text-color-2);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: var(--hover-background-color);
}

.confirm-btn {
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: var(--primary-color);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: opacity 0.15s;
}

.confirm-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
