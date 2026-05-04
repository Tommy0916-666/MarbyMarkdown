import { useStorage } from "@vueuse/core";
import type { ChatSession, ChatMessage } from "@/renderer/services/ai";
import { computed } from "vue";

// 存储的聊天历史
const chatHistoryStorage = useStorage<ChatSession[]>("marbymarkdown-ai-chat-history", [], localStorage, {
  mergeDefaults: true,
});

export function useAIChatHistory() {
  // 所有聊天历史
  const allSessions = computed(() => chatHistoryStorage.value);
  
  // 获取某个文件的所有聊天会话（按更新时间倒序，最新的在前）
  const getSessionsForFile = (filePath: string) => {
    return [...chatHistoryStorage.value]
      .filter(s => s.filePath === filePath)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  };
  
  // 获取某个文件的最新聊天会话（如果有）
  const getLatestSessionForFile = (filePath: string) => {
    const sessions = getSessionsForFile(filePath);
    return sessions[0] || null;
  };
  
  // 获取单个会话
  const getSession = (sessionId: string) => {
    return chatHistoryStorage.value.find(s => s.id === sessionId) || null;
  };
  
  // 为某个文件创建新的聊天会话
  const createNewSessionForFile = (filePath: string, fileName: string) => {
    const session: ChatSession = {
      id: Date.now().toString(),
      filePath,
      fileName,
      title: "新对话", // 默认标题
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    chatHistoryStorage.value.push(session);
    return session;
  };
  
  // 添加消息到会话
  const addMessageToSession = (sessionId: string, message: ChatMessage) => {
    const session = chatHistoryStorage.value.find(s => s.id === sessionId);
    if (session) {
      session.messages.push(message);
      session.updatedAt = Date.now();
    }
  };
  
  // 添加多条消息到会话
  const addMessagesToSession = (sessionId: string, messages: ChatMessage[]) => {
    const session = chatHistoryStorage.value.find(s => s.id === sessionId);
    if (session) {
      session.messages.push(...messages);
      session.updatedAt = Date.now();
    }
  };
  
  // 更新会话标题
  const updateSessionTitle = (sessionId: string, title: string) => {
    const session = chatHistoryStorage.value.find(s => s.id === sessionId);
    if (session) {
      session.title = title;
      session.updatedAt = Date.now();
    }
  };
  
  // 清空某个会话的消息
  const clearSessionMessages = (sessionId: string) => {
    const session = chatHistoryStorage.value.find(s => s.id === sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
    }
  };
  
  // 删除某个会话
  const deleteSession = (sessionId: string) => {
    const index = chatHistoryStorage.value.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      chatHistoryStorage.value.splice(index, 1);
    }
  };
  
  // 删除所有会话
  const deleteAllSessions = () => {
    chatHistoryStorage.value = [];
  };
  
  // 获取会话列表（按更新时间倒序）
  const getSessionsList = () => {
    return [...chatHistoryStorage.value].sort((a, b) => b.updatedAt - a.updatedAt);
  };
  
  return {
    allSessions,
    getSessionsForFile,
    getLatestSessionForFile,
    getSession,
    createNewSessionForFile,
    addMessageToSession,
    addMessagesToSession,
    updateSessionTitle,
    clearSessionMessages,
    deleteSession,
    deleteAllSessions,
    getSessionsList,
  };
}
