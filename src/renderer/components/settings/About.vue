<script setup lang="ts">
import { version } from "../../../../package.json";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
</script>

<template>
  <div class="AboutBox">
    <h1 class="link">
      <img src="/logo.png" class="logo" /> MarbyMarkdown
    </h1>
    <p>
      <span class="version">
        version: V{{ version }}
      </span>
    </p>
    <p>MIT Copyright © [2026] Tommy0916</p>
    <p>
      Powered by MarbyMarkdown
    </p>
    <p class="tip">MarbyMarkdown 是完全免费开源的软件</p>
  </div>
</template>

<style lang="less" scoped>
.AboutBox {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .version {
    font-size: 12px;
    color: var(--text-color-2);
    margin-top: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .tip {
    position: absolute;
    bottom: 30px;
    font-size: 10px;
    color: var(--primary-color-transparent);
  }

  h1 {
    font-size: 20px;
    margin: 0;
    color: var(--text-color);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 .logo {
    width: 64px;
    height: 64px;
    vertical-align: middle;
    margin-right: 8px;
  }

  p {
    font-size: 14px;
    color: var(--text-color-2);
  }
}
</style>
