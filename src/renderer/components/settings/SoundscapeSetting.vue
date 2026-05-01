<script setup lang="ts">
import { ref, computed } from 'vue';
import AppIcon from '@/renderer/components/ui/AppIcon.vue';
import { Switch } from '@/renderer/components/ui/switch';
import { Slider } from '@/renderer/components/ui/slider';
import { getSoundscapeController } from '@/renderer/utils/soundscape';
import type { WhiteNoiseType } from '@/renderer/utils/soundscape/types';

const soundscape = getSoundscapeController();
const config = computed(() => soundscape.getConfig());

const soundscapeCategoryExpanded = ref(true);
const whiteNoiseExpanded = ref(true);
const musicExpanded = ref(true);

function handleKeydown() {
  soundscape.notifyTypingStart();
}

function toggleSoundscape(enabled: boolean) {
  soundscape.toggleSoundscape(enabled);
}

function toggleWhiteNoise(enabled: boolean) {
  soundscape.toggleWhiteNoise(enabled);
}

function updateWhiteNoiseItem(id: WhiteNoiseType, enabled: boolean) {
  soundscape.updateWhiteNoiseItem(id, enabled);
}

function setWhiteNoiseMasterVolume(value: number) {
  soundscape.setWhiteNoiseMasterVolume(value);
}

function toggleWhiteNoiseRandom(enabled: boolean) {
  soundscape.toggleWhiteNoiseRandom(enabled);
}

function toggleThemeSync(enabled: boolean) {
  soundscape.toggleThemeSync(enabled);
}

function toggleMusic(enabled: boolean) {
  soundscape.toggleMusic(enabled);
}

function toggleMusicAutoMode(enabled: boolean) {
  soundscape.toggleMusicAutoMode(enabled);
}

function setMusicMasterVolume(value: number) {
  soundscape.setMusicMasterVolume(value);
}

function selectMusic(musicId: string) {
  soundscape.selectMusic(musicId);
}

function toggleSmartVolume(enabled: boolean) {
  soundscape.toggleSmartVolume(enabled);
}

function toggleShowInStatusBar(enabled: boolean) {
  soundscape.toggleShowInStatusBar(enabled);
}
</script>

<template>
  <div class="SoundscapeSettingBox">
    <!-- 声景模块主标题 -->
    <div class="category-container">
      <div class="category-header" @click="soundscapeCategoryExpanded = !soundscapeCategoryExpanded">
        <span class="category-icon-badge">
          <AppIcon name="soundscape" />
        </span>
        <div class="category-title-group">
          <h2 class="category-title">声景功能</h2>
          <span class="category-desc">白噪音、背景音乐、智能音量等功能</span>
        </div>
        <span class="expand-icon" :class="{ expanded: soundscapeCategoryExpanded }">
          <AppIcon name="arrow-right" />
        </span>
      </div>

      <div v-if="soundscapeCategoryExpanded" class="category-content">
        <!-- 声景主开关 -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge">
              <AppIcon name="soundscape" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">启用声景</h3>
              <span class="sub-desc">开启后将播放白噪音和背景音乐</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <Switch
              :modelValue="config.enabled"
              @update:modelValue="toggleSoundscape"
              label="启用声景功能"
            />
          </div>
        </div>

        <!-- 在状态栏显示声景控件开关 -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge">
              <AppIcon name="soundscape" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">状态栏控件</h3>
              <span class="sub-desc">在应用状态栏显示快速声景控制按钮</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <Switch
              :modelValue="config.showInStatusBar"
              @update:modelValue="toggleShowInStatusBar"
              label="在状态栏显示控件"
            />
          </div>
        </div>

        <div class="sub-divider" />

        <!-- 智能音量 -->
        <div class="sub-setting-item">
          <div class="sub-setting-header">
            <span class="sub-title-badge smart">
              <AppIcon name="volume" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">智能音量</h3>
              <span class="sub-desc">打字时自动降低音量</span>
            </div>
          </div>
          <div class="sub-setting-content">
            <Switch
              :modelValue="config.smartVolume"
              @update:modelValue="toggleSmartVolume"
              label="启用智能音量"
            />
          </div>
        </div>

        <div class="sub-divider" />

        <!-- 白噪音 -->
        <div class="sub-setting-item">
          <div class="sub-setting-header" @click="whiteNoiseExpanded = !whiteNoiseExpanded">
            <span class="sub-title-badge noise">
              <AppIcon name="rain" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">白噪音</h3>
              <span class="sub-desc">雨声、溪流、篝火等环境音效</span>
            </div>
            <span class="expand-icon" :class="{ expanded: whiteNoiseExpanded }">
              <AppIcon name="arrow-right" />
            </span>
          </div>
          <div v-if="whiteNoiseExpanded" class="sub-setting-content">
            <div class="white-noise-section">
              <Switch
                :modelValue="config.whiteNoise.enabled"
                @update:modelValue="toggleWhiteNoise"
                label="启用白噪音"
              />

              <template v-if="config.whiteNoise.enabled">
                <div class="volume-slider-container">
                  <Slider
                    label="总音量"
                    :modelValue="config.whiteNoise.masterVolume"
                    :min="0"
                    :max="100"
                    :step="1"
                    @update:modelValue="setWhiteNoiseMasterVolume"
                  />
                </div>

                <div class="white-noise-grid">
                  <div
                    v-for="item in config.whiteNoise.items"
                    :key="item.id"
                    class="noise-item"
                    :class="{ active: item.enabled }"
                    @click.stop="updateWhiteNoiseItem(item.id, !item.enabled)"
                  >
                    <span class="emoji">{{ item.emoji }}</span>
                    <div class="item-info">
                      <span class="item-name">{{ item.name }}</span>
                      <span class="item-desc">{{ item.description }}</span>
                    </div>
                    <Switch
                      :modelValue="item.enabled"
                      @update:modelValue="(val) => updateWhiteNoiseItem(item.id, val)"
                      :style="{ width: 'auto' }"
                    />
                  </div>
                </div>

                <div class="switch-row">
                  <Switch
                    :modelValue="config.whiteNoise.autoRandom"
                    @update:modelValue="toggleWhiteNoiseRandom"
                    label="自动随机组合"
                  />
                </div>

                <div class="switch-row">
                  <Switch
                    :modelValue="config.whiteNoise.syncWithTheme"
                    @update:modelValue="toggleThemeSync"
                    label="与马卡龙主题联动"
                  />
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="sub-divider" />

        <!-- 背景音乐 -->
        <div class="sub-setting-item">
          <div class="sub-setting-header" @click="musicExpanded = !musicExpanded">
            <span class="sub-title-badge music">
              <AppIcon name="music" />
            </span>
            <div class="sub-title-group">
              <h3 class="sub-title">背景音乐</h3>
              <span class="sub-desc">放松、清晨、专注、黄昏等氛围音乐</span>
            </div>
            <span class="expand-icon" :class="{ expanded: musicExpanded }">
              <AppIcon name="arrow-right" />
            </span>
          </div>
          <div v-if="musicExpanded" class="sub-setting-content">
            <div class="music-section">
              <Switch
                :modelValue="config.music.enabled"
                @update:modelValue="toggleMusic"
                label="启用背景音乐"
              />

              <template v-if="config.music.enabled">
                <div class="volume-slider-container">
                  <Slider
                    label="总音量"
                    :modelValue="config.music.masterVolume"
                    :min="0"
                    :max="100"
                    :step="1"
                    @update:modelValue="setMusicMasterVolume"
                  />
                </div>

                <div class="switch-row">
                  <Switch
                    :modelValue="config.music.autoMode"
                    @update:modelValue="toggleMusicAutoMode"
                    label="自动氛围模式"
                  />
                </div>

                <div class="music-list-section">
                  <div class="section-subtitle">选择氛围音乐</div>
                  <div class="music-list">
                    <div
                      v-for="music in config.music.builtinMusic"
                      :key="music.id"
                      class="music-item"
                      :class="{ active: config.music.currentIndex === config.music.playlist.indexOf(music.id) }"
                      @click="selectMusic(music.id)"
                    >
                      <span class="music-emoji">{{ music.emoji || '🎵' }}</span>
                      <div class="music-info">
                        <span class="music-name">{{ music.name }}</span>
                        <div class="music-tags">
                          <span v-for="tag in music.tags" :key="tag" class="tag">{{ tag }}</span>
                        </div>
                      </div>
                      <span v-if="config.music.currentIndex === config.music.playlist.indexOf(music.id)" class="playing-icon">
                        <AppIcon name="sound-wave" />
                      </span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.SoundscapeSettingBox {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  box-sizing: border-box;
  gap: 20px;
  max-width: 800px;

  .category-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: background 0.2s;

    &:hover {
      background: var(--hover-background-color);
    }

    .category-icon-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 14px;
      flex-shrink: 0;
      color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 14%, transparent);
      font-size: 18px;
    }

    .category-title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .category-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--text-color);
      margin: 0;
    }

    .category-desc {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-color-2);
    }

    .expand-icon {
      font-size: 16px;
      color: var(--text-color-3);
      transition: transform 0.2s;
      flex-shrink: 0;

      &.expanded {
        transform: rotate(90deg);
      }
    }
  }

  .category-content {
    padding-left: 54px;
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .sub-divider {
    height: 1px;
    background: var(--border-color-1);
    margin: 0 0 20px 0;
  }

  .sub-setting-item {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
  }

  .sub-setting-header {
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    padding: 4px 0;
    border-radius: 6px;
    transition: background 0.2s;

    &:hover {
      background: var(--hover-background-color);
    }

    .sub-title-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      flex-shrink: 0;
      color: var(--text-color-2);
      background: color-mix(in srgb, var(--text-color-2) 10%, transparent);
      font-size: 16px;

      &.smart {
        color: #f59e0b;
        background: color-mix(in srgb, #f59e0b 14%, transparent);
      }

      &.noise {
        color: #6366f1;
        background: color-mix(in srgb, #6366f1 14%, transparent);
      }

      &.music {
        color: #ec4899;
        background: color-mix(in srgb, #ec4899 14%, transparent);
      }
    }

    .sub-title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .sub-title {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--text-color);
      margin: 0;
    }

    .sub-desc {
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-color-2);
    }
  }

  .sub-setting-content {
    padding-left: 50px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .white-noise-section,
  .music-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .volume-slider-container {
    width: 100%;
    max-width: 450px;
  }

  .switch-row {
    width: 100%;
  }

  .white-noise-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }

  .noise-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--background-color-2);
    border: 2px solid transparent;
    transition: all 0.2s;
    cursor: pointer;

    &:hover {
      background: var(--background-color-1);
    }

    &.active {
      border-color: var(--primary-color);
      background: var(--background-color-1);
    }

    .emoji {
      font-size: 20px;
      flex-shrink: 0;
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .item-name {
        font-size: 13px;
        color: var(--text-color);
        font-weight: 500;
      }

      .item-desc {
        font-size: 11px;
        color: var(--text-color-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .music-list-section {
    .section-subtitle {
      font-size: 13px;
      color: var(--text-color-2);
      margin-bottom: 12px;
    }
  }

  .music-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .music-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--background-color-2);
    border: 2px solid transparent;
    transition: all 0.2s;
    cursor: pointer;

    &:hover {
      background: var(--background-color-1);
    }

    &.active {
      border-color: var(--primary-color);
      background: var(--background-color-1);
    }

    .music-emoji {
      font-size: 18px;
      flex-shrink: 0;
    }

    .music-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .music-name {
        font-size: 13px;
        color: var(--text-color);
        font-weight: 500;
      }
    }

    .music-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary-color), transparent 80%);
      color: var(--primary-color);
    }

    .playing-icon {
      font-size: 16px;
      color: var(--primary-color);
      animation: pulse 1s infinite;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@media (max-width: 768px) {
  .SoundscapeSettingBox {
    .category-content {
      padding-left: 0;
    }

    .sub-setting-content {
      padding-left: 0;
    }
  }
}
</style>
