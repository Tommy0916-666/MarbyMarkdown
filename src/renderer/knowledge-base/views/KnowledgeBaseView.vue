<script setup lang="ts">
import { onMounted, ref, computed, defineComponent, type PropType, nextTick } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import emitter from "@/renderer/events";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  mtime: number;
  children?: FileNode[];
}

const props = defineProps<{
  kbPath: string;
  kbName: string;
}>();

const activeTab = ref<"files" | "outline">("files");
const loading = ref(true);
const fileTree = ref<FileNode[]>([]);
const expandedDirs = ref<Set<string>>(new Set());
const selectedFile = ref<FileNode | null>(null);

const showCreateDialog = ref(false);
const newFileName = ref("");
const creating = ref(false);
const createError = ref("");

const TreeNode = defineComponent({
  name: "TreeNode",
  props: {
    node: { type: Object as PropType<FileNode>, required: true },
    expandedDirs: { type: Set as PropType<Set<string>>, required: true },
    selectedFile: { type: Object as PropType<FileNode | null>, required: true }
  },
  emits: ["toggle", "select"],
  setup(treeProps, { emit }) {
    const isExpanded = computed(() => treeProps.expandedDirs.has(treeProps.node.path));
    const isSelected = computed(() =>
      treeProps.selectedFile && treeProps.selectedFile.path === treeProps.node.path
    );

    function handleClick() {
      if (treeProps.node.isDirectory) {
        emit("toggle", treeProps.node.path);
      } else {
        emit("select", treeProps.node);
      }
    }

    return { isExpanded, isSelected, handleClick };
  },
  template: `
    <div class="tree-node">
      <div
        class="node-item"
        :class="{ selected: isSelected }"
        @click="handleClick"
      >
        <AppIcon v-if="node.isDirectory" :name="isExpanded ? 'folder-opened' : 'folder-copy'" class="node-icon" />
        <AppIcon v-else name="document" class="node-icon" />
        <span class="node-name">{{ node.name }}</span>
      </div>
      <div v-if="node.isDirectory && isExpanded && node.children" class="node-children">
        <TreeNode
          v-for="child in node.children"
          :key="child.path"
          :node="child"
          :expanded-dirs="expandedDirs"
          :selected-file="selectedFile"
          @toggle="emit('toggle', \$event)"
          @select="emit('select', \$event)"
        />
      </div>
    </div>
  `
});

async function loadFileTree() {
  try {
    const files = await window.electronAPI.getDirectoryFiles(props.kbPath);
    if (files && files.length > 0) {
      fileTree.value = files.map((f: any) => ({
        name: f.name,
        path: f.path,
        isDirectory: f.isDirectory,
        mtime: f.mtime,
        children: f.children ? f.children.map((c: any) => ({
          name: c.name,
          path: c.path,
          isDirectory: c.isDirectory,
          mtime: c.mtime,
          children: c.children || [],
        })) : [],
      }));
      if (fileTree.value.length > 0 && fileTree.value[0].isDirectory) {
        expandedDirs.value.add(fileTree.value[0].path);
      }
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
  await nextTick();
}

async function confirmCreate() {
  const name = newFileName.value.trim();
  if (!name) {
    createError.value = "请输入文件名";
    return;
  }
  if (!name.endsWith(".md")) {
    createError.value = "文件名必须以 .md 结尾";
    return;
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

async function openFolder() {
  await window.electronAPI.openKbPath(props.kbPath);
}

function toggleDir(dirPath: string) {
  if (expandedDirs.value.has(dirPath)) {
    expandedDirs.value.delete(dirPath);
  } else {
    expandedDirs.value.add(dirPath);
  }
}

function goBack() {
  emitter.emit("kb:back-to-list");
}

function openFile(file: FileNode) {
  if (!file.isDirectory) {
    selectedFile.value = file;
    // 实际打开文件到编辑器中
    emitter.emit("kb:open-file", file.path);
  }
}

onMounted(() => {
  loadFileTree();
});
</script>

<template>
  <div class="kb-view">
    <div class="kb-header">
      <button class="back-btn" @click="goBack">
        <AppIcon name="arrow-right" class="back-icon" />
        返回
      </button>
      <div class="kb-title">
        <AppIcon name="library" class="kb-icon" />
        <h2 class="kb-name">{{ kbName }}</h2>
      </div>
      <div class="spacer"></div>
      <button class="action-btn" @click="createDocument" title="新建文档">
        <AppIcon name="plus" />
      </button>
      <button class="action-btn" @click="openFolder" title="在资源管理器中打开">
        <AppIcon name="folder-opened" />
      </button>
    </div>

    <div class="kb-content">
      <div class="left-sidebar">
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

        <div v-if="activeTab === 'files'" class="tree-container">
          <div v-if="loading" class="tree-loading">
            <AppIcon name="loading" class="spinning" />
            加载中...
          </div>
          <div v-else class="file-tree">
            <TreeNode
              v-for="node in fileTree"
              :key="node.path"
              :node="node"
              :expanded-dirs="expandedDirs"
              :selected-file="selectedFile"
              @toggle="toggleDir"
              @select="openFile"
            />
          </div>
        </div>

        <div v-else class="outline-container">
          <div class="placeholder">
            <AppIcon name="List-outlined" class="placeholder-icon" />
            <p>请先打开一个文件查看大纲</p>
          </div>
        </div>
      </div>

      <div class="main-area">
        <div v-if="selectedFile" class="editor-placeholder">
          <div class="file-header">
            <AppIcon name="document" class="file-icon" />
            <span class="file-name">{{ selectedFile.name }}</span>
          </div>
          <div class="content-area">
            <p class="hint">文件将在此处打开</p>
          </div>
        </div>
        <div v-else class="empty-state">
        <AppIcon name="library" class="empty-icon" />
        <h3>欢迎来到 {{ kbName }}</h3>
        <p>请从左侧选择文件开始编辑</p>
      </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCreateDialog" class="dialog-overlay" @click.self="cancelCreate">
        <div class="create-dialog" @keydown.escape="cancelCreate">
          <div class="dialog-header">
            <h3>新建文档</h3>
            <button class="close-btn" @click="cancelCreate">
              <AppIcon name="close" />
            </button>
          </div>
          <div class="dialog-body">
            <label class="input-label">文件名称</label>
            <div class="input-row">
              <input
                ref="nameInputRef"
                v-model="newFileName"
                type="text"
                class="name-input"
                placeholder="例如：笔记.md"
                @keydown.enter="confirmCreate"
                autofocus
              />
            </div>
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

<style lang="less" scoped>
.kb-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
}

.kb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-1);
  background: var(--background-color-1);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-color-2);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--hover-background-color);
    color: var(--text-color);
  }

  .back-icon {
    transform: rotate(180deg);
  }
}

.kb-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kb-icon {
  color: var(--primary-color);
  font-size: 20px;
}

.kb-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.spacer {
  flex: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-color-2);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--hover-background-color);
    color: var(--text-color);
  }
}

.kb-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-sidebar {
  width: 280px;
  border-right: 1px solid var(--border-color-1);
  display: flex;
  flex-direction: column;
  background: var(--background-color-1);
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border-color-1);
  padding: 0 8px;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border: none;
  background: transparent;
  color: var(--text-color-2);
  cursor: pointer;
  font-size: 13px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-color);
  }

  &.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
  }

  .tab-icon {
    font-size: 16px;
  }
}

.tree-container,
.outline-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  color: var(--text-color-3);
  font-size: 14px;

  .spinning {
    animation: spin 1s linear infinite;
  }
}

.file-tree {
  padding: 0 4px;
}

.tree-node {
  .node-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;

    &:hover {
      background: var(--hover-background-color);
    }

    &.selected {
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
      color: var(--primary-color);
    }

    .node-icon {
      font-size: 16px;
      color: var(--text-color-3);
      flex-shrink: 0;
    }

    &.selected .node-icon {
      color: var(--primary-color);
    }

    .node-name {
      font-size: 13px;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .node-children {
    margin-left: 12px;
    border-left: 1px solid var(--border-color-1);
    margin-top: 2px;
    margin-bottom: 2px;
  }
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 16px;
  color: var(--text-color-3);
  font-size: 13px;
  text-align: center;

  .placeholder-icon {
    font-size: 32px;
    opacity: 0.4;
  }

  p {
    margin: 0;
  }
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--background-color);
  padding: 20px;
  box-sizing: border-box;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-color-3);

  .empty-icon {
    font-size: 64px;
    opacity: 0.3;
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-2);
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

.editor-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color-1);
  background: var(--background-color-1);
}

.file-icon {
  font-size: 18px;
  color: var(--primary-color);
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.content-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hint {
  color: var(--text-color-3);
  font-size: 14px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.create-dialog {
  width: 400px;
  background: var(--background-color-1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color-1);

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-color-3);
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: var(--hover-background-color);
      color: var(--text-color);
    }
  }
}

.dialog-body {
  padding: 20px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-color-2);
}

.name-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-color-1);
  border-radius: 8px;
  background: var(--background-color);
  color: var(--text-color);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: var(--primary-color);
  }

  &::placeholder {
    color: var(--text-color-3);
  }
}

.error-text {
  margin: 8px 0 0;
  font-size: 12px;
  color: #d35b5b;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color-1);

  .cancel-btn {
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    background: transparent;
    color: var(--text-color-2);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;

    &:hover {
      background: var(--hover-background-color);
    }
  }

  .confirm-btn {
    height: 36px;
    padding: 0 16px;
    border: none;
    border-radius: 8px;
    background: var(--primary-color);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: opacity 0.15s;

    &:hover:not(:disabled) {
      opacity: 0.88;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
