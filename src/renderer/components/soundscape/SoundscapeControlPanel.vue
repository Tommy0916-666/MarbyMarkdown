<script setup lang="ts">
import { ref, computed } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import { getSoundscapeController } from "@/renderer/utils/soundscape";
import emitter from "@/renderer/events";

const soundscape = getSoundscapeController();
const config = computed(() => soundscape.getConfig());
const isPanelVisible = ref(false);

// 暂停状态
const isWhiteNoisePaused = ref(false);
const isMusicPaused = ref(false);

function togglePanel() {
  isPanelVisible.value = !isPanelVisible.value;
}

function toggleWhiteNoise() {
  if (isWhiteNoisePaused.value) {
    // 继续
    soundscape.resumeWhiteNoise();
    isWhiteNoisePaused.value = false;
  } else {
    // 暂停
    soundscape.pauseWhiteNoise();
    isWhiteNoisePaused.value = true;
  }
}

function toggleMusic() {
  if (isMusicPaused.value) {
    soundscape.resumeMusic();
    isMusicPaused.value = false;
  } else {
    soundscape.pauseMusic();
    isMusicPaused.value = true;
  }
}

function prevMusic() {
  soundscape.playPrevMusic();
}

function nextMusic() {
  soundscape.playNextMusic();
}

function goToSettings() {
  // 关闭面板
  isPanelVisible.value = false;
  // 发送事件打开设置并跳转到拓展功能页
  emitter.emit("settings:open");
  emitter.emit("settings:go-to-extension");
}

const currentMusicItem = computed(() => {
  return config.value.music.builtinMusic.find(m => m.id === config.value.music.playlist[config.value.music.currentIndex]);
});
</script>

<template>
  <div v-if="config.showInStatusBar" class="soundscape-control-panel">
    <!-- 按钮 -->
    <button
      class="status-icon-btn"
      @click="togglePanel"
      title="声景控制面板"
    >
      <AppIcon name="soundscape" />
    </button>

    <!-- 面板弹出动画容器 -->
    <Transition name="slide-up">
      <div v-if="isPanelVisible" class="panel-backdrop" @click.self="togglePanel">
        <div class="panel-wrapper">
          <div class="panel-container">
            <!-- 面板标题 -->
            <div class="panel-header">
              <div class="header-left">
                <span class="panel-icon">
                  <AppIcon name="soundscape" />
                </span>
                <div class="header-text">
                  <h3>声景</h3>
                </div>
              </div>
              <button class="close-btn" @click="togglePanel">
                <AppIcon name="close" />
              </button>
            </div>

            <!-- 面板内容 -->
            <div class="panel-content">
              <!-- 白噪音控制 -->
              <div class="control-group">
                <div class="control-row">
                  <div class="control-info">
                    <span class="control-icon noise">
                      <AppIcon name="rain" />
                    </span>
                    <span class="control-label">白噪音</span>
                  </div>
                  <button
                    class="control-button"
                    :class="{ active: config.whiteNoise.enabled && !isWhiteNoisePaused }"
                    @click="toggleWhiteNoise"
                    title="暂停/继续白噪音"
                  >
                    <AppIcon
                      v-if="config.whiteNoise.enabled && !isWhiteNoisePaused"
                      name="sound-wave"
                    />
                    <span v-else class="pause-icon">⏸</span>
                  </button>
                </div>
              </div>

              <!-- 背景音乐控制 -->
              <div class="control-group">
                <div class="control-row music-row">
                  <div class="control-info">
                    <span class="control-icon music">
                      <AppIcon name="music" />
                    </span>
                    <div class="music-info">
                      <span class="control-label">{{ currentMusicItem?.name || '背景音乐' }}</span>
                      <span class="music-tag" v-if="currentMusicItem">
                        {{ currentMusicItem.tags[0] }}
                      </span>
                    </div>
                  </div>

                  <div class="music-controls">
                    <button
                      class="nav-button"
                      @click="prevMusic"
                      title="上一首"
                    >
                      <span class="arrow-icon">◀</span>
                    </button>

                    <button
                      class="control-button play-pause"
                      :class="{ active: config.music.enabled && !isMusicPaused }"
                      @click="toggleMusic"
                      title="暂停/继续音乐"
                    >
                      <AppIcon
                        v-if="config.music.enabled && !isMusicPaused"
                        name="sound-wave"
                      />
                      <span v-else class="play-icon">▶</span>
                    </button>

                    <button
                      class="nav-button"
                      @click="nextMusic"
                      title="下一首"
                    >
                      <span class="arrow-icon">▶</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 更多设置 -->
              <div class="settings-link">
                <button class="settings-btn" @click="goToSettings">
                  <AppIcon name="config-props" />
                  更多设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="less" scoped>
.soundscape-control-panel {
  position: relative;
}

.status-icon-btn {
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color-2);
  padding: 4px;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;

  &:hover {
    color: var(--text-color-1);
    background: var(--hover-background-color);
  }
}

/* 面板弹出动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(15px) scale(0.97);
}

/* 背景遮罩 */
.panel-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  background: transparent;
}

/* 面板容器 */
.panel-wrapper {
  position: fixed;
  bottom: 50px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;

  .panel-container {
    pointer-events: auto;
    background: var(--background-color-1);
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 0 0 1px var(--border-color-1);
    min-width: 300px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}

/* 面板头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color-1);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .panel-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 16%, transparent);
      font-size: 16px;
    }
  }

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
    border-radius: 8px;
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

/* 面板内容 */
.panel-content {
  padding: 12px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;

  .control-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .control-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: var(--text-color-2);
    background: color-mix(in srgb, var(--text-color-2) 12%, transparent);

    &.noise {
      color: #6366f1;
      background: color-mix(in srgb, #6366f1 14%, transparent);
    }

    &.music {
      color: #ec4899;
      background: color-mix(in srgb, #ec4899 14%, transparent);
    }
  }

  .control-label {
    font-size: 14px;
    color: var(--text-color);
  }

  .music-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .control-label {
      font-weight: 500;
    }

    .music-tag {
      font-size: 11px;
      color: var(--text-color-3);
      padding: 2px 8px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary-color), transparent 85%);
      color: var(--primary-color);
      width: fit-content;
    }
  }
}

/* 控制按钮 */
.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: var(--background-color-2);
  color: var(--text-color-3);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--background-color-2), var(--background-color-1) 40%);
  }

  &.active {
    background: color-mix(in srgb, var(--primary-color), transparent 80%);
    color: var(--primary-color);

    &:hover {
      background: color-mix(in srgb, var(--primary-color), transparent 70%);
    }
  }

  .pause-icon {
    font-size: 15px;
  }

  .play-icon {
    font-size: 14px;
    margin-left: 1px;
  }
}

/* 导航按钮 */
.music-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-color-2);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--hover-background-color);
    color: var(--text-color);
  }

  .arrow-icon {
    font-size: 13px;
  }
}

/* 更多设置按钮 */
.settings-link {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color-1);
}

.settings-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color-1);
  background: var(--background-color-2);
  color: var(--text-color-2);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: color-mix(in srgb, var(--background-color-1), var(--primary-color) 8%);
  }
}

/* 响应式 */
@media (max-width: 400px) {
  .panel-wrapper {
    right: 10px;
    left: 10px;

    .panel-container {
      min-width: auto;
      width: 100%;
    }
  }
}
</style>
