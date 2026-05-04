import { onMounted, onUnmounted, ref } from "vue";
import emitter from "@/renderer/events";

const isShowOutline = ref(false);
function toggleShowOutline(status?: boolean | null | Event) {
  // 检查是否是有效的 boolean 值（排除事件对象）
  const isBoolean = typeof status === "boolean";
  isShowOutline.value = isBoolean ? status : !isShowOutline.value;
}
export default function useOutline() {
  const outline = ref<{ id: string; level: number; text: string; pos: number }[]>([] as any);
  onMounted(() => {
    emitter.on("outline:Update", setOutline);
  });
  onUnmounted(() => {
    emitter.off("outline:Update", setOutline);
  });
  function setOutline(headings: any) {
    outline.value = headings;
  }

  return {
    outline,
    isShowOutline,
  };
}
export { isShowOutline, toggleShowOutline };
