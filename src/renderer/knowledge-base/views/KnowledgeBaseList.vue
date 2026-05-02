<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import KnowledgeBaseWizard from "../components/KnowledgeBaseWizard.vue";
import emitter from "@/renderer/events";

const knowledgeBases = ref<KnowledgeBaseInfo[]>([]);
const loading = ref(true);
const showWizard = ref(false);

async function loadList() {
  try {
    knowledgeBases.value = await window.electronAPI.listKnowledgeBases();
  } catch (e) {
    console.error("加载知识库列表失败:", e);
  } finally {
    loading.value = false;
  }
}

async function handleCreate(name: string, description: string) {
  if (knowledgeBases.value.some((kb) => kb.name === name)) {
    alert("已存在同名知识库，请使用其他名称。");
    return;
  }

  const result = await window.electronAPI.createKnowledgeBase(name, description);
  if (result) {
    showWizard.value = false;
    await loadList();
  } else {
    alert("创建失败，可能已存在同名知识库。");
  }
}

async function handleDelete(kb: KnowledgeBaseInfo) {
  if (!window.confirm(`确定要删除知识库"${kb.name}"吗？\n\n此操作不可撤销，将删除该知识库下的所有数据。`)) {
    return;
  }

  const success = await window.electronAPI.deleteKnowledgeBase(kb.path);
  if (success) {
    await loadList();
  } else {
    alert("删除失败。");
  }
}

function handleOpen(kb: KnowledgeBaseInfo) {
  emitter.emit("kb:open-kb", kb);
}

function handleBack() {
  emitter.emit("kb:back-to-editor");
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

onMounted(() => {
  loadList();
});
</script>

<template>
  <div class="KbListPage">
    <div class="pageHeader">
      <button class="backBtn" @click="handleBack">
        <AppIcon name="arrow-right" class="backIcon" />
        返回编辑器
      </button>
      <div class="headerMain">
        <h1 class="pageTitle">我的知识库</h1>
        <button class="createBtn" @click="showWizard = true">
          <AppIcon name="plus" class="btnIcon" />
          新建知识库
        </button>
      </div>
    </div>

    <div class="pageContent">
      <div v-if="loading" class="emptyState">加载中...</div>

      <div v-else-if="knowledgeBases.length === 0" class="emptyState">
        <AppIcon name="folder-opened" class="emptyIcon" />
        <p>还没有知识库，点击右上角"新建知识库"开始创建。</p>
      </div>

      <div v-else class="cardGrid">
        <div
          v-for="kb in knowledgeBases"
          :key="kb.path"
          class="kbCard"
          @click="handleOpen(kb)"
        >
          <div class="cardBody">
            <div class="cardIcon">
              <AppIcon name="folder-opened" />
            </div>
            <div class="cardInfo">
              <div class="cardName">{{ kb.name }}</div>
              <div class="cardDate">{{ formatDate(kb.createdAt) }}</div>
            </div>
          </div>
          <div class="cardActions">
            <button
              class="cardBtn primary"
              @click.stop="handleOpen(kb)"
            >
              打开
            </button>
            <button
              class="cardBtn danger"
              @click.stop="handleDelete(kb)"
            >
              <AppIcon name="trash" class="btnIcon" />
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <KnowledgeBaseWizard
      v-if="showWizard"
      @create="handleCreate"
      @cancel="showWizard = false"
    />
  </div>
</template>

<style lang="less" scoped>
.KbListPage {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
}

.pageHeader {
  padding: 20px 24px 12px;
  flex-shrink: 0;

  .backBtn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--primary-color);
    cursor: pointer;
    font-size: 13px;
    margin-bottom: 12px;

    .backIcon {
      transform: rotate(180deg);
    }

    &:hover {
      opacity: 0.8;
    }
  }

  .headerMain {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .pageTitle {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
  }

  .createBtn {
    height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: 8px;
    background: var(--primary-color);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: opacity 0.2s ease;

    .btnIcon {
      font-size: 16px;
    }

    &:hover {
      opacity: 0.88;
    }
  }
}

.pageContent {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--text-color-2);
  font-size: 14px;

  .emptyIcon {
    font-size: 48px;
    opacity: 0.4;
  }

  p {
    margin: 0;
  }
}

.cardGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.kbCard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border-color-1);
  border-radius: 10px;
  background: var(--background-color-1);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--border-color-2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .cardBody {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .cardIcon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    color: var(--primary-color);
    font-size: 20px;
    flex-shrink: 0;
  }

  .cardInfo {
    flex: 1;
    min-width: 0;
  }

  .cardName {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cardDate {
    font-size: 12px;
    color: var(--text-color-3);
    margin-top: 2px;
  }

  .cardActions {
    display: flex;
    gap: 8px;
    border-top: 1px solid var(--border-color-1);
    padding-top: 12px;
  }

  .cardBtn {
    flex: 1;
    height: 34px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: opacity 0.2s ease;

    .btnIcon {
      font-size: 14px;
    }

    &.primary {
      background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      color: var(--primary-color);

      &:hover {
        opacity: 0.8;
      }
    }

    &.danger {
      background: color-mix(in srgb, #d35b5b 10%, transparent);
      color: #d35b5b;

      &:hover {
        opacity: 0.8;
      }
    }
  }
}

@media (max-width: 768px) {
  .pageHeader {
    padding: 12px 14px 8px;

    .pageTitle {
      font-size: 20px;
    }
  }

  .pageContent {
    padding: 0 14px 14px;
  }

  .cardGrid {
    grid-template-columns: 1fr;
  }
}
</style>
