import { ref } from "vue";

const isShowAIChatSidebar = ref(false);
const isAIChatFullscreen = ref(false);

function toggleAIChatSidebar(status?: boolean | null | Event) {
  // 检查是否是有效的 boolean 值（排除事件对象）
  const isBoolean = typeof status === "boolean";
  isShowAIChatSidebar.value = isBoolean ? status : !isShowAIChatSidebar.value;
}

function toggleAIChatFullscreen() {
  isAIChatFullscreen.value = !isAIChatFullscreen.value;
}

export default function useAIChatSidebar() {
  return {
    isShowAIChatSidebar,
    isAIChatFullscreen,
    toggleAIChatFullscreen,
  };
}

export { isShowAIChatSidebar, toggleAIChatSidebar, isAIChatFullscreen, toggleAIChatFullscreen };
