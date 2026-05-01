<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import { useAIConfig } from "@/renderer/hooks/useAIConfig";
import { useAIChatHistory } from "@/renderer/hooks/useAIChatHistory";
import { isAIChatFullscreen, toggleAIChatFullscreen } from "@/renderer/hooks/useAIChatSidebar";
import { AIService, type ChatMessage } from "@/renderer/services/ai";
import useTab from "@/renderer/hooks/useTab";
import autotoast from "autotoast.js";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";

const { chatConfig, chatEffectiveConfig } = useAIConfig();
const chatHistory = useAIChatHistory();
const { currentTab } = useTab();

// UI 状态
const isHistoryPanelOpen = ref(false);
const isLoading = ref(false);
const inputValue = ref("");
const messagesContainerRef = ref<HTMLElement | null>(null);
const streamingContent = ref("");
const isStreaming = ref(false);
const isThinking = ref(false);
const copiedMessageIndex = ref<number | null>(null);
const copiedTimeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);

// 是否需要显示回到下方按钮
const shouldShowScrollButton = ref(false);

// 正在处理的会话ID！流式输出中要记录这个！
const activeChatSessionId = ref<string | null>(null);

// 正在查看的会话
const viewingSessionId = ref<string | null>(null);

// 当前文件信息
const currentFilePath = computed(() => currentTab.value?.filePath || null);
const currentFileName = computed(() => currentTab.value?.name || "未命名文档");
const isCurrentFileSaved = computed(() => currentFilePath.value !== null);

// 当前正在查看的会话
const viewingSession = computed(() => {
  if (viewingSessionId.value) {
    return chatHistory.getSession(viewingSessionId.value);
  }
  if (currentFilePath.value) {
    return chatHistory.getLatestSessionForFile(currentFilePath.value);
  }
  return null;
});

// 当前显示的会话对应的文件名
const viewingFileName = computed(() => {
  return viewingSession.value?.fileName || null;
});

// 当前显示的会话对应的文件路径
const viewingFilePath = computed(() => {
  return viewingSession.value?.filePath || null;
});

// 显示的消息（包括正在流式传输的）
const displayMessages = computed(() => {
  // 如果正在流式输出，优先使用activeChatSessionId对应的会话！
  let messages: ChatMessage[] = [];
  
  if (isStreaming.value && activeChatSessionId.value) {
    const activeSession = chatHistory.getSession(activeChatSessionId.value);
    messages = activeSession?.messages || [];
  } else if (viewingSession.value) {
    messages = viewingSession.value.messages;
  }
  
  if (isStreaming.value && viewingSessionId.value === activeChatSessionId.value) {
    return [
      ...messages,
      { role: "assistant", content: streamingContent.value } as ChatMessage,
    ];
  }
  return messages;
});

// 检查当前是否可以发消息
const canChat = computed(() => {
  // 如果正在流式输出，就不能发新消息
  if (isStreaming.value || isThinking.value) {
    return false;
  }
  // 如果当前没有文件打开，不能发
  if (!isCurrentFileSaved.value || !currentFilePath.value) {
    return false;
  }
  // 如果正在查看的不是当前文件的会话，不能发消息
  if (viewingSession.value && viewingFilePath.value !== currentFilePath.value) {
    return false;
  }
  // 如果没有查看的会话，或者是当前文件的会话，就能发消息
  return true;
});

// 检查当前是否是在查看其他文档的历史会话
const isViewingOtherDoc = computed(() => {
  return viewingSession.value !== null && viewingFilePath.value !== currentFilePath.value;
});

// 监听消息容器滚动，判断是否需要显示回到下方按钮
const handleMessagesScroll = (e: Event) => {
  const el = e.target as HTMLElement;
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  shouldShowScrollButton.value = !isNearBottom;
};

// Markdown 渲染
const renderMarkdown = (content: string) => {
  try {
    const result = unified()
      .use(remarkParse)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeStringify)
      .processSync(content);
    return String(result);
  } catch (error) {
    console.error("[Markdown Render] Error:", error);
    return content.replace(/\n/g, "<br>");
  }
};

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
  }
};

// 复制消息
const copyMessage = async (content: string, index: number) => {
  try {
    await navigator.clipboard.writeText(content);
    copiedMessageIndex.value = index;
    if (copiedTimeoutRef.value) {
      clearTimeout(copiedTimeoutRef.value);
    }
    copiedTimeoutRef.value = setTimeout(() => {
      copiedMessageIndex.value = null;
    }, 2000);
  } catch (error) {
    autotoast.show("复制失败", "error");
  }
};

// 新建聊天
const startNewChat = async () => {
  if (!isCurrentFileSaved.value || !currentFilePath.value) {
    autotoast.show("请先保存文档，然后再新建聊天", "error");
    return;
  }
  
  // 创建新会话
  const newSession = chatHistory.createNewSessionForFile(
    currentFilePath.value,
    currentFileName.value
  );
  
  viewingSessionId.value = newSession.id;
  inputValue.value = "";
  await nextTick();
  await scrollToBottom();
};

// 发送消息
const sendMessage = async () => {
  if (!inputValue.value.trim() || isLoading.value || isStreaming.value || isThinking.value) {
    return;
  }

  if (!isCurrentFileSaved.value) {
    autotoast.show("请先保存文档，然后再使用 AI 聊天功能", "error");
    return;
  }

  if (viewingSession.value && viewingFilePath.value !== currentFilePath.value) {
    autotoast.show(`请先打开文件 \"${viewingFileName.value}\" 才能继续该对话`, "error");
    return;
  }

  // 获取或创建当前会话
  let sessionId = viewingSessionId.value;
  if (!sessionId || !viewingSession.value || viewingFilePath.value !== currentFilePath.value) {
    // 没有会话或者是其他文档的会话，创建新的
    const newSession = chatHistory.createNewSessionForFile(
      currentFilePath.value!,
      currentFileName.value
    );
    sessionId = newSession.id;
    viewingSessionId.value = sessionId;
  }
  
  // 记录当前正在聊天的会话！
  activeChatSessionId.value = sessionId;
  
  isThinking.value = true;
  isLoading.value = true;
  streamingContent.value = "";

  const userMessage: ChatMessage = {
    role: "user",
    content: inputValue.value.trim(),
  };

  // 添加用户消息到界面
  chatHistory.addMessageToSession(sessionId, userMessage);

  const userInput = inputValue.value;
  inputValue.value = "";

  // 重置 textarea 高度
  await nextTick();
  const textarea = document.querySelector(".chat-input") as HTMLTextAreaElement;
  if (textarea) {
    textarea.style.height = "40px";
  }

  await scrollToBottom();

  try {
    let messagesToSend: ChatMessage[] = [];

    // 获取当前会话的消息
    const freshSession = chatHistory.getSession(activeChatSessionId.value!);

    if (chatConfig.value.enableContext && freshSession) {
      messagesToSend = [...freshSession.messages];
    } else {
      messagesToSend = [userMessage];
    }

    const documentContent = currentTab.value?.content || "";

    // 短暂显示思考状态，然后开始流式输出
    await new Promise(resolve => setTimeout(resolve, 300));
    isThinking.value = false;
    isStreaming.value = true;
    isLoading.value = false;

    // 调用流式 API
    let finalContent = "";
    await AIService.chatStream(
      chatEffectiveConfig.value,
      messagesToSend,
      (chunk) => {
        finalContent += chunk;
        streamingContent.value = finalContent;
        scrollToBottom();
      },
      (title) => {
        // 完成
        const parsed = AIService.parseChatResponse(finalContent);
        const contentToSave = parsed.content;
        if (contentToSave.trim()) {
          chatHistory.addMessageToSession(
            activeChatSessionId.value!,
            { role: "assistant", content: contentToSave }
          );
        }
        // 更新标题（如果有）
        if (title) {
          chatHistory.updateSessionTitle(activeChatSessionId.value!, title);
        } else if (parsed.title) {
          chatHistory.updateSessionTitle(activeChatSessionId.value!, parsed.title);
        }
        isStreaming.value = false;
        streamingContent.value = "";
        finalContent = "";
      },
      (error) => {
        isStreaming.value = false;
        isThinking.value = false;
        streamingContent.value = "";
        finalContent = "";
        autotoast.show(`聊天失败：${error.message || "未知错误"}`, "error");
      },
      documentContent
    );

  } catch (error: any) {
    console.error("[AI Chat] Error:", error);
    autotoast.show(`聊天失败：${error.message || "未知错误"}`, "error");
    isLoading.value = false;
    isStreaming.value = false;
    isThinking.value = false;
  }
};

const toggleHistoryPanel = () => {
  isHistoryPanelOpen.value = !isHistoryPanelOpen.value;
};

const switchToSession = (sessionId: string) => {
  isHistoryPanelOpen.value = false;
  viewingSessionId.value = sessionId;
  // 切换会话后滚动到底部
  nextTick(() => {
    scrollToBottom();
  });
};

// 切换回当前文件的最新会话
const switchToCurrentDocSession = () => {
  if (currentFilePath.value) {
    const latest = chatHistory.getLatestSessionForFile(currentFilePath.value);
    viewingSessionId.value = latest?.id || null;
  } else {
    viewingSessionId.value = null;
  }
};

const deleteHistorySession = (sessionId: string) => {
  chatHistory.deleteSession(sessionId);
  // 如果删除的是正在查看的会话，清空
  if (viewingSessionId.value === sessionId) {
    viewingSessionId.value = null;
  }
};

const handleInputKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

// 动态调整 textarea 高度
const autoResize = (e: Event) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  const newHeight = Math.min(target.scrollHeight, 200);
  target.style.height = newHeight + "px";
};

watch(() => displayMessages.value.length, () => {
  scrollToBottom();
});

// 监听当前打开的文件变化
watch(() => currentFilePath.value, (newFilePath) => {
  // 如果用户正在查看的会话不是当前正在打开的文档
  // 就不强制清空，让用户继续查看历史记录
  if (viewingSession.value && viewingSessionId.value) {
    const viewingSessionPath = viewingSession.value.filePath
    if (viewingSessionPath !== newFilePath) {
      // 保持查看其他文档的历史，不清空 viewingSessionId，让用户继续看
      return
    }
  }
  // 如果用户没有在查看会话，就查看当前文件的最新会话
  if (newFilePath) {
    const latest = chatHistory.getLatestSessionForFile(newFilePath);
    viewingSessionId.value = latest?.id || null;
  } else {
    viewingSessionId.value = null;
  }
});
</script>

<template>
  <div class="AIChatSidebar">
    <svg viewBox="0 0 5 5" fill="none" xmlns="http://www.w3.org/2000/svg" class="AIChatSidebarBefore">
      <path d="M5 0L2 0C4 -4.37114e-08 5 1 5 3L5 0Z" />
    </svg>
    <svg viewBox="0 0 5 5" fill="none" xmlns="http://www.w3.org/2000/svg" class="AIChatSidebarAfter">
      <path d="M5 5L0 5C3.33333 5 5 3.33333 5 0L5 5Z" />
    </svg>

    <div class="AIChatSidebarHeader">
      <div class="header-left">
        <button class="fullscreen-button" @click="toggleAIChatFullscreen" :title="isAIChatFullscreen ? '退出全屏' : '全屏模式'">
          <AppIcon :name="isAIChatFullscreen ? 'minimize' : 'maximize'" />
        </button>
        <span class="header-title">AI 聊天</span>
      </div>
      <div class="header-right">
        <button 
          v-if="isCurrentFileSaved && !isHistoryPanelOpen"
          class="new-chat-button-header"
          @click="startNewChat"
          title="新建会话"
        >
          <AppIcon name="plus" />
        </button>
        <button class="history-button" @click="toggleHistoryPanel" :class="{ active: isHistoryPanelOpen }">
          <AppIcon name="history" />
        </button>
      </div>
    </div>

    <div class="content-container">
      <div v-if="isHistoryPanelOpen" class="history-panel">
        <div class="history-header">
          <span class="history-title">聊天历史</span>
          <button 
            v-if="isCurrentFileSaved"
            class="new-chat-button"
            @click="startNewChat"
            title="新建会话"
          >
            <AppIcon name="plus" />
          </button>
        </div>
        <div class="history-list">
          <div
            v-for="session in chatHistory.getSessionsList()"
            :key="session.id"
            class="history-item"
            :class="{ 'history-item-active': (viewingSessionId && viewingSessionId === session.id) || (!viewingSessionId && session.filePath === currentFilePath) }"
            @click="switchToSession(session.id)"
          >
            <div class="history-item-header">
              <AppIcon name="message-square" class="history-icon" />
              <span class="history-name">{{ session.title || "新对话" }}</span>
            </div>
            <div class="history-item-subtitle">
              <AppIcon name="file-text" class="subtitle-icon" />
              <span class="history-file-name">{{ session.fileName }}</span>
            </div>
            <div class="history-item-info">
              <span class="history-message-count">{{ session.messages.length }} 条消息</span>
              <span class="history-date">{{ new Date(session.updatedAt).toLocaleDateString() }}</span>
            </div>
            <button
              class="delete-history-button"
              @click.stop="deleteHistorySession(session.id)"
              title="删除历史"
            >
              <AppIcon name="trash" />
            </button>
          </div>
          <div v-if="chatHistory.allSessions.length === 0" class="empty-history">
            暂无聊天历史
          </div>
        </div>
      </div>

      <div v-else class="chat-container">
        <div v-if="viewingSession" class="session-header">
          <div class="session-title-row">
            <AppIcon name="message-square" class="session-icon" />
            <span class="session-title">{{ viewingSession.title || "新对话" }}</span>
            <button
              v-if="isViewingOtherDoc"
              class="switch-back-button"
              @click="switchToCurrentDocSession"
              title="回到当前文档的会话"
            >
              返回当前
            </button>
          </div>
          <div class="session-file-row">
            <AppIcon name="file-text" class="file-icon" />
            <span class="session-file-name">{{ viewingSession.fileName }}</span>
          </div>
        </div>

        <div class="messages-container" ref="messagesContainerRef" @scroll="handleMessagesScroll">
          <div v-if="displayMessages.length === 0 && !isThinking" class="empty-state">
            <AppIcon name="ai-chat" class="empty-icon" />
            <span class="empty-text">开始与 AI 聊天吧！</span>
          </div>

          <div v-else class="messages-list">
            <div
              v-for="(message, index) in displayMessages"
              :key="index"
              class="message"
              :class="{
                'user-message': message.role === 'user',
                'ai-message': message.role === 'assistant',
                'streaming': isStreaming && index === displayMessages.length - 1 && message.role === 'assistant'
              }"
              :data-index="index"
            >
              <div class="message-wrapper">
                <div class="message-avatar" v-if="message.role === 'assistant'">
                  <AppIcon name="bot" />
                </div>
                <div class="message-content">
                  <div class="message-header" v-if="message.role === 'assistant'">
                    <span class="message-role">AI 助手</span>
                  </div>
                  <div class="message-header" v-if="message.role === 'user'">
                    <span class="message-role">用户</span>
                  </div>
                  <div
                    class="message-text"
                    v-html="renderMarkdown(message.content)"
                  ></div>
                  <div class="message-actions">
                    <button
                      class="copy-button"
                      @click.stop="copyMessage(message.content, index)"
                      :title="copiedMessageIndex === index ? '已复制' : '复制'"
                    >
                      <AppIcon v-if="copiedMessageIndex !== index" name="document-copy" />
                      <AppIcon v-else name="check" />
                    </button>
                  </div>
                </div>
                <div class="message-avatar user-avatar" v-if="message.role === 'user'">
                  <AppIcon name="user" />
                </div>
              </div>
            </div>

            <!-- 思考中状态 -->
            <div v-if="isThinking" class="message ai-message thinking-message">
              <div class="message-wrapper">
                <div class="message-avatar">
                  <AppIcon name="bot" />
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <span class="message-role">AI 助手</span>
                  </div>
                  <div class="message-text thinking-text">
                    <div class="thinking-dots">
                      <span class="dot"></span>
                      <span class="dot"></span>
                      <span class="dot"></span>
                    </div>
                    思考中
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          v-if="shouldShowScrollButton && displayMessages.length > 0"
          class="scroll-to-bottom-button"
          @click="scrollToBottom"
        >
          <AppIcon name="chevron-down" />
        </button>

        <div v-if="isViewingOtherDoc" class="warning-banner">
          <AppIcon name="alert-circle" />
          <span>请先打开文件 \"{{ viewingFileName }}\" 才能继续该对话</span>
        </div>

        <div class="input-container">
          <textarea
            v-model="inputValue"
            class="chat-input"
            :class="{ 'chat-input-disabled': isViewingOtherDoc }"
            :placeholder="isViewingOtherDoc ? '请先打开对应文档才能发消息...' : '输入你的问题...'"
            :disabled="!canChat || isLoading || isStreaming || isThinking || !isCurrentFileSaved"
            @keydown="handleInputKeydown"
            @input="autoResize"
            rows="1"
          ></textarea>
          <button
            class="send-button"
            :class="{ 'send-button-disabled': isViewingOtherDoc }"
            :disabled="!inputValue.trim() || !canChat || isLoading || isStreaming || isThinking || !isCurrentFileSaved"
            @click="sendMessage"
          >
            <AppIcon v-if="!isLoading && !isStreaming && !isThinking" name="send" />
            <span v-else class="loading-spinner"></span>
          </button>
        </div>

        <div v-if="!isCurrentFileSaved && !isViewingOtherDoc" class="save-hint">
          <AppIcon name="alert-circle" />
          <span>请先保存文档以使用 AI 聊天</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.AIChatSidebar {
  width: 100%;
  height: 100%;
  background: var(--background-color-2);
  display: flex;
  flex-direction: column;
  position: relative;
  user-select: text; /* 允许文本选择 */

  &::-webkit-scrollbar {
    display: none;
  }

  @keyframes slideInFromRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .AIChatSidebarBefore {
    height: 10px;
    width: 10px;
    position: absolute;
    left: -10px;
    top: 0;
    fill: var(--background-color-2);
    z-index: 999;

    .AIChatSidebar.fullscreen & {
      display: none;
    }
  }
  .AIChatSidebarAfter {
    height: 10px;
    width: 10px;
    position: absolute;
    left: -10px;
    bottom: 0;
    fill: var(--background-color-2);
    z-index: 999;

    .AIChatSidebar.fullscreen & {
      display: none;
    }
  }

  .AIChatSidebarHeader {
      width: 100%;
      background: var(--background-color-2);
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color-1);

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .header-title {
        font-size: 13px;
        font-weight: bold;
        color: var(--text-color-2);
      }

      .fullscreen-button,
      .history-button {
        background: transparent;
        border: none;
        color: var(--text-color-3);
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background-color 0.2s, color 0.2s;

        &:hover {
          background: var(--hover-background-color);
          color: var(--text-color-2);
        }

        &.active {
          color: var(--primary-color);
        }
      }

      .new-chat-button-header {
        background: var(--primary-color);
        border: none;
        color: white;
        padding: 6px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s, transform 0.2s;

        &:hover {
          opacity: 0.9;
          transform: scale(1.05);
        }
      }
    }

  .content-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &::-webkit-scrollbar {
      display: none;
    }

    .history-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .history-header {
        padding: 12px 15px;
        border-bottom: 1px solid var(--border-color-1);
        display: flex;
        align-items: center;
        justify-content: space-between;

        .history-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-color-2);
        }

        .new-chat-button {
          background: var(--primary-color);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s, transform 0.2s;

          &:hover {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }
      }

      .history-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;

        .history-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 10px 12px;
            margin-bottom: 6px;
            border-radius: 8px;
            background: var(--background-color-1);
            cursor: pointer;
            position: relative;
            transition: background-color 0.2s, border-color 0.2s;
            border: 1px solid transparent;

            &:hover {
              background: var(--hover-background-color);

              .delete-history-button {
                opacity: 1;
              }
            }
            
            &.history-item-active {
              background: color-mix(in srgb, var(--primary-color) 12%, var(--background-color-1));
              border-color: color-mix(in srgb, var(--primary-color) 50%, var(--background-color-1));
            }

          .history-item-header {
            display: flex;
            align-items: center;
            gap: 8px;

            .history-icon {
              font-size: 14px;
              color: var(--text-color-3);
            }

            .history-name {
              font-size: 13px;
              font-weight: 500;
              color: var(--text-color-1);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              flex: 1;
            }
          }

          .history-item-subtitle {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 2px;

            .subtitle-icon {
              font-size: 11px;
              color: var(--text-color-4);
            }

            .history-file-name {
              font-size: 11px;
              color: var(--text-color-3);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              flex: 1;
            }
          }

          .history-item-info {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            padding-left: 22px;
            margin-top: 4px;

            .history-message-count,
            .history-date {
              font-size: 11px;
              color: var(--text-color-3);
            }
          }

          .delete-history-button {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: var(--background-color-2);
            border: 1px solid var(--border-color-1);
            border-radius: 4px;
            padding: 6px;
            cursor: pointer;
            color: var(--text-color-3);
            opacity: 0;
            transition: background-color 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s;

            &:hover {
              background: #fee2e2;
              color: #ef4444;
              border-color: #ef4444;
            }
          }
        }

        .empty-history {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-color-3);
          font-size: 12px;
        }
      }
    }

    .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        position: relative;

        .scroll-to-bottom-button {
          position: absolute;
          bottom: 140px;
          right: 20px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--background-color-2);
          border: 1px solid var(--border-color-1);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          color: var(--text-color-2);
          transition: opacity 0.2s, transform 0.2s, background-color 0.2s, color 0.2s, border-color 0.2s;
          
          &:hover {
            background: var(--hover-background-color);
            color: var(--primary-color);
            border-color: var(--primary-color);
            transform: translateY(-2px);
          }
        }

        .session-header {
          padding: 10px 15px;
          border-bottom: 1px solid var(--border-color-1);
          background: color-mix(in srgb, var(--primary-color) 5%, transparent);
          display: flex;
          flex-direction: column;
          gap: 6px;

          .session-title-row {
            display: flex;
            align-items: center;
            gap: 8px;

            .session-icon {
              font-size: 14px;
              color: var(--text-color-3);
              flex-shrink: 0;
            }

            .session-title {
              font-size: 13px;
              font-weight: 600;
              color: var(--text-color-1);
              flex: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .switch-back-button {
              background: transparent;
              border: 1px solid var(--border-color-1);
              color: var(--text-color-2);
              font-size: 10px;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              white-space: nowrap;
              flex-shrink: 0;
              transition: background-color 0.2s, border-color 0.2s, color 0.2s;
              
              &:hover {
                background: var(--hover-background-color);
                border-color: var(--text-color-3);
              }
            }
          }

          .session-file-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding-left: 22px;

            .file-icon {
              font-size: 11px;
              color: var(--text-color-4);
              flex-shrink: 0;
            }

            .session-file-name {
              font-size: 11px;
              color: var(--text-color-3);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              flex: 1;
            }
          }
        }

      .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 15px;

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 12px;

          .empty-icon {
            font-size: 32px;
            color: var(--text-color-3);
            opacity: 0.5;
          }

          .empty-text {
            color: var(--text-color-3);
            font-size: 12px;
          }
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 16px;

          .message {
            display: flex;
            max-width: 100%;
            animation: messageFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);

            .message-wrapper {
              display: flex;
              gap: 10px;
              width: 100%;
              align-items: flex-start;
            }

            .message-avatar {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              border-radius: 6px;
              flex-shrink: 0;
              font-size: 14px;
              background: var(--background-color-1);
              color: var(--text-color-2);
            }

            .user-avatar {
              background: color-mix(in srgb, var(--primary-color) 15%, transparent);
              color: var(--primary-color);
            }

            .message-content {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 4px;

              .message-header {
                display: flex;
                align-items: center;
                gap: 6px;

                .message-role {
                  font-size: 11px;
                  font-weight: 600;
                  color: var(--text-color-2);
                }
              }

              .message-text {
                padding: 10px 14px;
                border-radius: 10px;
                font-size: 13px;
                line-height: 1.7;
                color: var(--text-color-1);
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
                user-select: text;

                :deep(p) {
                  margin: 0.5em 0;
                }

                :deep(p:first-child) {
                  margin-top: 0;
                }

                :deep(p:last-child) {
                  margin-bottom: 0;
                }

                :deep(code) {
                  background: var(--background-color-2);
                  padding: 0.1em 0.4em;
                  border-radius: 4px;
                  font-size: 0.9em;
                }

                :deep(pre) {
                  background: var(--background-color-2);
                  padding: 10px;
                  border-radius: 8px;
                  overflow-x: auto;
                  margin: 0.5em 0;

                  code {
                    background: transparent;
                    padding: 0;
                  }
                }

                :deep(ul),
                :deep(ol) {
                  margin: 0.5em 0;
                  padding-left: 1.5em;
                }

                :deep(li) {
                  margin: 0.2em 0;
                }

                :deep(blockquote) {
                  border-left: 3px solid var(--border-color-1);
                  padding-left: 10px;
                  margin: 0.5em 0;
                  color: var(--text-color-2);
                }

                :deep(h1),
                :deep(h2),
                :deep(h3),
                :deep(h4) {
                  margin: 0.8em 0 0.4em 0;
                  font-weight: 600;
                }

                :deep(h1) {
                  font-size: 1.5em;
                }

                :deep(h2) {
                  font-size: 1.3em;
                }

                :deep(h3) {
                  font-size: 1.1em;
                }

                :deep(a) {
                  color: var(--primary-color);
                  text-decoration: underline;
                }

                :deep(table) {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 0.5em 0;
                }

                :deep(th),
                :deep(td) {
                  border: 1px solid var(--border-color-1);
                  padding: 6px 10px;
                  text-align: left;
                }
              }

              .message-actions {
                display: flex;
                gap: 4px;
                margin-top: 4px;
                opacity: 0;
                transition: opacity 0.2s;
                padding: 0 4px;

                .copy-button {
                  background: transparent;
                  border: none;
                  color: var(--text-color-3);
                  cursor: pointer;
                  padding: 4px;
                  border-radius: 4px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: background-color 0.2s, color 0.2s;

                  &:hover {
                    background: var(--hover-background-color);
                    color: var(--text-color-2);
                  }
                }
              }
            }

            &:hover .message-actions {
              opacity: 1;
            }

            &.user-message {
              flex-direction: row-reverse;

              .message-wrapper {
                flex-direction: row-reverse;
              }

              .message-text {
                background: var(--primary-color);
                color: #ffffff;

                :deep(code) {
                  background: rgba(255, 255, 255, 0.1);
                }

                :deep(pre) {
                  background: rgba(255, 255, 255, 0.1);
                }

                :deep(blockquote) {
                  border-left-color: rgba(255, 255, 255, 0.3);
                  color: rgba(255, 255, 255, 0.9);
                }

                :deep(a) {
                  color: #fff;
                }

                :deep(th),
                :deep(td) {
                  border-color: rgba(255, 255, 255, 0.2);
                }
              }

              .message-actions .copy-button {
                color: rgba(255, 255, 255, 0.7);

                &:hover {
                  background: rgba(255, 255, 255, 0.1);
                  color: #fff;
                }
              }
            }

            &.ai-message {
              .message-text {
                background: var(--background-color-1);
              }
            }

            &.streaming {
              .message-text::after {
                content: "▋";
                animation: blink 1s infinite;
                opacity: 0.7;
              }
            }

            /* 思考中消息 */
            &.thinking-message {
              .thinking-text {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;

                .thinking-dots {
                  display: flex;
                  gap: 4px;

                  .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--text-color-2);
                    animation: dotPulse 1.4s infinite ease-in-out;

                    &:nth-child(1) {
                      animation-delay: 0s;
                    }
                    &:nth-child(2) {
                      animation-delay: 0.2s;
                    }
                    &:nth-child(3) {
                      animation-delay: 0.4s;
                    }
                  }
                }
              }
            }
          }
        }
      }

      .warning-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 15px;
        background: #fffbeb;
        border-top: 1px solid #fef3c7;

        .clear-warning-button {
          margin-left: auto;
          padding: 6px 12px;
          border: 1px solid #fcd34d;
          background: #fffbeb;
          color: #d97706;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;

          &:hover {
            background: #fcd34d;
            color: #92400e;
          }
        }
      }

      .input-container {
        display: flex;
        gap: 10px;
        padding: 12px 15px;
        border-top: 1px solid var(--border-color-1);
        align-items: flex-end;

        .chat-input {
          flex: 1;
          min-height: 40px;
          max-height: 200px;
          padding: 10px 14px;
          border: 1px solid var(--border-color-1);
          border-radius: 8px;
          background: var(--background-color-1);
          color: var(--text-color-1);
          font-size: 13px;
          resize: none;
          line-height: 1.6;
          overflow-y: auto;
          transition: border-color 0.2s, background-color 0.2s, color 0.2s, opacity 0.2s;

          &:focus {
            outline: none;
            border-color: var(--primary-color);
          }

          &::placeholder {
            color: var(--text-color-3);
          }

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          &.chat-input-disabled {
            background: color-mix(in srgb, var(--background-color-2) 80%, var(--text-color-3));
            color: var(--text-color-3);
            border-color: var(--text-color-3);
            cursor: not-allowed;
            opacity: 0.7;
            
            &::placeholder {
              color: var(--text-color-3);
              opacity: 0.8;
            }
          }
        }

        .send-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s, opacity 0.2s, transform 0.2s;
          flex-shrink: 0;

          &:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-1px);
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          &.send-button-disabled {
            background: var(--text-color-3);
            cursor: not-allowed;
            opacity: 0.5;
            
            &:hover {
              transform: none;
              opacity: 0.5;
            }
          }

          .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
        }
      }

      .save-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 15px;
        border-top: 1px solid var(--border-color-1);
        background: var(--background-color-1);

        span {
          font-size: 12px;
          color: var(--text-color-2);
        }
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 0.1;
  }
}

@keyframes dotPulse {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}

@keyframes messageFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
