<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import emitter from "@/renderer/events";
import MenuBar from "./MenuBar.vue";

const isOpen = ref(false);

function handleFileChange() {
  isOpen.value = false;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) {
    isOpen.value = false;
  }
}

function handleOpenSettings() {
  isOpen.value = true;
}

watch(isOpen, (val) => {
  if (val) {
    emitter.emit("settings:open");
  }
});

onMounted(() => {
  emitter.on("file:Change", handleFileChange);
  emitter.on("settings:open", handleOpenSettings);
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  emitter.off("file:Change", handleFileChange);
  emitter.off("settings:open", handleOpenSettings);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="MenuDropDownBox">
    <div class="dropdown-header">
      <svg
        class="logo"
        :class="{ active: isOpen }"
        @click="isOpen = !isOpen"
        width="18"
        height="14"
        viewBox="0 0 18 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M1 1H17M1 7H17M1 13H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <Transition name="menu-slide">
      <div v-show="isOpen" class="dropdown-content">
        <MenuBar />
      </div>
    </Transition>
  </div>
</template>

<style lang="less" scoped>
.MenuDropDownBox {
  height: 100%;
  .dropdown-header {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    cursor: pointer;
    padding: 0 0 3px 10px;
    height: 100%;
    -webkit-app-region: no-drag; /* 禁止拖动 */
    .logo {
      display: inline-block;
      width: 18px;
      height: 14px;
      transition: 0.2s;
      margin: 4px;
      color: var(--primary-color);
      &.active {
        transform: rotate(180deg);
      }
    }
  }
  .dropdown-content {
    position: absolute;
    top: 40px; /* 与标题栏高度一致 */
    left: 0;
    background: var(--background-color-1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    width: 100%;
    height: 100%;
    border-radius: 4px;
    -webkit-app-region: no-drag; /* 禁止拖动 */
    white-space: nowrap;
  }
}

.menu-slide-enter-active,
.menu-slide-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.menu-slide-enter-from,
.menu-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
