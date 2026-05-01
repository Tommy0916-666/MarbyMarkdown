<script setup lang="ts">
import { onMounted, computed } from "vue";
import AppIcon from "@/renderer/components/ui/AppIcon.vue";
import useTheme from "@/renderer/hooks/useTheme";

const { themes, currentTheme, init, setTheme, addTempTheme, removeTheme, exportTheme } = useTheme();

// 分离常规主题和特殊主题
const regularThemes = computed(() => {
  return themes.value.filter(t => t.name !== 'macaron-flow');
});

const specialThemes = computed(() => {
  return themes.value.filter(t => t.name === 'macaron-flow');
});

onMounted(() => {
  init();
});
</script>

<template>
  <div class="ThemePageBox">
    <!-- 常规预设主题区域 -->
    <div class="themes-section">
      <div class="section-title">
        <span class="title-text">预设主题</span>
        <span class="title-desc">经典配色，所见即所得</span>
      </div>
      <div class="theme-select-area">
        <div
          v-for="option in regularThemes"
          :key="option.name"
          class="theme-select-item"
          :class="{
            active: option.name === currentTheme,
            'custom-theme': option.isCustom,
          }"
          @click.stop="setTheme(option.name)"
        >
          <!-- 自定义主题：上下色块 + 文字 -->
          <template v-if="option.isCustom">
            <div class="custom-theme-ellipse">
              <div
                class="custom-theme-color-main"
                :style="{ backgroundColor: option.data?.themeProperties?.['--background-color'] }"
              ></div>
              <div
                class="custom-theme-color-second"
                :style="{ backgroundColor: option.data?.themeProperties?.['--background-color-2'] }"
              ></div>
            </div>
            <div class="custom-theme-text">
              <span class="custom-theme-label">{{ option.label }}</span>
              <div class="custom-theme-icons">
                <AppIcon
                  name="edit"
                  class="theme-action-icon edit-icon"
                  title="编辑主题"
                  @click.stop="addTempTheme(option.name)"
                />
                <AppIcon
                  name="download"
                  class="theme-action-icon download-icon"
                  title="下载主题"
                  @click.stop="exportTheme(option.name)"
                />
                <AppIcon
                  name="close"
                  class="theme-action-icon delete-icon"
                  title="删除主题"
                  @click.stop="removeTheme(option.name)"
                />
              </div>
            </div>
          </template>

          <!-- 预设主题：上下布局 -->
          <template v-else>
            <div
              class="theme-select-item-main"
              :style="{ backgroundColor: option.data?.themeProperties?.['--background-color'] }"
            ></div>
            <div
              class="theme-select-item-seceond"
              :style="{ backgroundColor: option.data?.themeProperties?.['--background-color-2'] }"
            ></div>
          </template>
        </div>

        <div
          class="theme-select-add"
          @click.stop="addTempTheme()"
          :class="{ 'theme-select-add-disabled': currentTheme === 'macaron-flow' }"
          :title="currentTheme === 'macaron-flow' ? '请先切换到其他主题再添加自定义主题' : '添加自定义主题'"
        >
          <div class="theme-select-add-btn">
            <AppIcon name="plus" />
          </div>
        </div>
      </div>
    </div>

    <!-- 特殊主题区域 -->
    <div class="themes-section special-section">
      <div class="section-title">
        <span class="title-text special-title">✨ 特殊主题</span>
        <span class="title-desc special-desc">独家马卡龙流光，会呼吸的配色</span>
      </div>
      <div class="theme-select-area">
        <div
          v-for="option in specialThemes"
          :key="option.name"
          class="theme-select-item special-theme-item"
          :class="{
            active: option.name === currentTheme,
          }"
          @click.stop="setTheme(option.name)"
        >
          <div class="special-theme-icon">
            <div class="macaron-gradient">
              <div class="macaron-color-1"></div>
              <div class="macaron-color-2"></div>
              <div class="macaron-color-3"></div>
            </div>
          </div>
          <div class="special-theme-info">
            <span class="special-theme-name">{{ option.label }}</span>
            <span class="special-theme-desc">{{ option.description }}</span>
          </div>
        </div>
      </div>

      <!-- 马卡龙流光主题详细介绍 -->
      <div class="special-theme-intro">
        <div class="intro-card">
          <div class="intro-header">
            <span class="intro-icon">🍡</span>
            <span class="intro-title">马卡龙流光的特别功能</span>
          </div>
          <ul class="intro-features">
            <li>
              <span class="feature-icon">⏰</span>
              <div class="feature-text">
                <strong>时间感知</strong>
                <span>颜色随一天中的不同时间段自动变化</span>
              </div>
            </li>
            <li>
              <span class="feature-icon">🌈</span>
              <div class="feature-text">
                <strong>柔和渐变</strong>
                <span>缓慢平滑的颜色过渡，不知不觉间给你惊喜</span>
              </div>
            </li>
            <li>
              <span class="feature-icon">🔋</span>
              <div class="feature-text">
                <strong>性能友好</strong>
                <span>CPU 占用接近为零，不会影响电脑性能</span>
              </div>
            </li>
            <li>
              <span class="feature-icon">🛡️</span>
              <div class="feature-text">
                <strong>隐私保护</strong>
                <span>无需定位权限，完全在本地运行，保护隐私</span>
              </div>
            </li>
          </ul>
          <div class="intro-tip">
            <AppIcon name="info" class="tip-icon" />
            <span>切换到其他主题可立即停止动态效果</span>
          </div>
        </div>
      </div>
    </div>

    <div class="theme-preview-frame">
      <div class="theme-preview-page">
        <div class="theme-preview-container">
          <div class="theme-preview-tabbar">
            <div class="theme-preview-tabbar-item active">
              <p>readme.md</p>
              <div class="closeIcon">
                <AppIcon name="close" />
              </div>
              <!-- pre -->
              <svg
                class="pre active"
                viewBox="0 0 5 5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 5L0 5C3.33333 5 5 3.33333 5 -2.18557e-07L5 5Z" />
              </svg>
              <!-- after -->
              <svg
                class="after active"
                viewBox="0 0 5 5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0 5L5 5C1.66667 5 7.28523e-08 3.33333 2.18557e-07 -2.18557e-07L0 5Z" />
              </svg>
            </div>

            <div class="addTab">
              <div class="addTabLine"></div>
              <AppIcon name="plus" />
            </div>
          </div>
          <div class="theme-preview-content">
            <div class="preview-header"></div>
            <div class="preview-lines">
              <div class="preview-line"></div>
              <div class="preview-line"></div>
              <div class="preview-line"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.ThemePageBox {
  width: 100%;
  height: 100%;
  padding: 0px;
  display: flex;
  flex-direction: column;
  gap: 28px;

  .themes-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;

    &.special-section {
      padding-top: 8px;
      border-top: 1px solid var(--border-color-2);
    }

    .section-title {
      display: flex;
      align-items: baseline;
      gap: 12px;

      .title-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color);

        &.special-title {
          background: linear-gradient(135deg, #ff9a9e 0%, #a8edea 50%, #ffc3a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      }

      .title-desc {
        font-size: 13px;
        color: var(--text-color-3);

        &.special-desc {
          color: var(--text-color-2);
        }
      }
    }

    .theme-select-area {
      width: 100%;
      display: flex;
      flex-direction: row;
      box-sizing: border-box;
      gap: 20px;
      flex-wrap: wrap;

      .theme-select-item {
        display: flex;
        flex-direction: column;
        height: 40px;
        width: 40px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid var(--background-color-3);
        box-shadow: rgba(0, 0, 0, 0.34) 0px 0px 2px;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          opacity: 0.6;
        }

        &.active {
          border: 2px solid var(--primary-color);
        }

        // 自定义主题样式
        &.custom-theme {
          flex-direction: row;
          align-items: center;
          height: 40px;
          width: auto;
          min-width: 120px;
          padding: 0 2px;
          border-radius: 100px;
          gap: 8px;

          .custom-theme-ellipse {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            overflow: hidden;
            //  border: 1px solid var(--background-color-3);
            box-shadow: rgba(0, 0, 0, 0.34) 0px 0px 4px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;

            .custom-theme-color-main {
              flex: 1;
            }

            .custom-theme-color-second {
              flex: 1;
            }
          }

          .custom-theme-text {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 80px;
            position: relative;

            .custom-theme-label {
              font-size: 12px;
              color: var(--text-color-3);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              transition: opacity 0.2s ease;
            }

            .custom-theme-icons {
              display: flex;
              padding-right: 10px;
              gap: 10px;
              align-items: center;
              justify-content: flex-end;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              opacity: 0;
              visibility: hidden;
              transition: all 0.2s ease;

              .theme-action-icon {
                font-size: 16px;
                color: var(--text-color-3);
                cursor: pointer;
                transition: all 0.2s ease;

                &:hover {
                  transform: scale(1.1);
                }

                &.edit-icon:hover {
                  color: var(--primary-color);
                }

                &.download-icon:hover {
                  color: #10b981;
                }

                &.delete-icon:hover {
                  color: #ef4444;
                }
              }
            }

            &:hover {
              .custom-theme-label {
                opacity: 0;
              }

              .custom-theme-icons {
                opacity: 1;
                visibility: visible;
              }
            }
          }
        }

        &.special-theme-item {
          width: auto;
          height: auto;
          min-width: 220px;
          border-radius: 16px;
          padding: 12px 16px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          background: var(--background-color-1);
          border: 2px solid var(--border-color-1);
          transition: all 0.3s ease;

          &:hover {
            opacity: 1;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border-color: var(--border-color-2);
          }

          &.active {
            border-color: var(--primary-color);
            background: var(--background-color);
            box-shadow: 0 0 0 3px var(--primary-color-transparent);
          }

          .special-theme-icon {
            width: 48px;
            height: 48px;
            flex-shrink: 0;

            .macaron-gradient {
              width: 100%;
              height: 100%;
              border-radius: 12px;
              overflow: hidden;
              position: relative;
              box-shadow: 0 2px 8px rgba(255, 154, 158, 0.3);

              .macaron-color-1,
              .macaron-color-2,
              .macaron-color-3 {
                position: absolute;
                width: 100%;
                height: 100%;
              }

              .macaron-color-1 {
                background: linear-gradient(135deg, #ff9a9e 0%, transparent 50%);
                animation: macaronPulse1 8s ease-in-out infinite;
              }

              .macaron-color-2 {
                background: linear-gradient(225deg, #a8edea 0%, transparent 50%);
                animation: macaronPulse2 8s ease-in-out infinite;
              }

              .macaron-color-3 {
                background: linear-gradient(315deg, #ffc3a0 0%, transparent 50%);
                animation: macaronPulse3 8s ease-in-out infinite;
              }
            }
          }

          .special-theme-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;

            .special-theme-name {
              font-size: 15px;
              font-weight: 600;
              color: var(--text-color);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .special-theme-desc {
              font-size: 12px;
              color: var(--text-color-3);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }

        .theme-select-item-main {
          flex: 1;
        }

        .theme-select-item-seceond {
          flex: 1;
        }
      }

      .theme-select-add {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 40px;
        width: 40px;
        padding: 0px;
        box-sizing: border-box;
        border-radius: 50%;
        overflow: hidden;
        filter: drop-shadow(0 0px 1px rgba(0, 128, 255, 0.1))
          drop-shadow(1px 1px 2px rgba(64, 255, 77, 0.15))
          drop-shadow(-1px 1px 2px rgba(255, 107, 119, 0.15))
          drop-shadow(1px -1px 2px rgba(255, 193, 7, 0.15))
          drop-shadow(-1px -1px 2px rgba(138, 43, 226, 0.15))
          drop-shadow(0 0px 4px rgba(255, 20, 147, 0.1));
        cursor: pointer;
        transition: all 0.3s;

        &.theme-select-add-disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .theme-select-add-btn {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--background-color-1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        svg {
          color: var(--text-color-1);
          font-size: 16px;
          font-weight: bold;
        }

        &:hover:not(.theme-select-add-disabled) {
          opacity: 0.6;
        }

        .theme-select-item-main {
          flex: 1;
        }

        .theme-select-item-seceond {
          flex: 1;
        }
      }
    }

    // 马卡龙流光主题详细介绍
    .special-theme-intro {
      width: 100%;
      margin-top: 8px;

      .intro-card {
        background: var(--background-color-1);
        border: 1px solid var(--border-color-1);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;

        .intro-header {
          display: flex;
          align-items: center;
          gap: 10px;

          .intro-icon {
            font-size: 24px;
          }

          .intro-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color);
          }
        }

        .intro-features {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;

          li {
            display: flex;
            align-items: flex-start;
            gap: 12px;

            .feature-icon {
              font-size: 20px;
              flex-shrink: 0;
              margin-top: 2px;
            }

            .feature-text {
              display: flex;
              flex-direction: column;
              gap: 2px;

              strong {
                font-size: 14px;
                color: var(--text-color);
                font-weight: 600;
              }

              span {
                font-size: 13px;
                color: var(--text-color-3);
              }
            }
          }
        }

        .intro-tip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--background-color-2);
          border-radius: 10px;
          font-size: 13px;
          color: var(--text-color-2);

          .tip-icon {
            font-size: 16px;
            color: var(--primary-color);
          }
        }
      }
    }
  }

  .theme-preview-frame {
    width: 100%;
    height: 100%;
    padding: 10px 0px 0 0;
    box-sizing: border-box;
    margin-top: 8px;

    position: relative;

    &::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 70px;
      background: linear-gradient(to bottom, transparent, var(--background-color));
      border-radius: 0 0 4px 4px;
      pointer-events: none;
    }

    .theme-preview-page {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      width: 100%;
      height: 280px;
      border-radius: 4px;
      box-shadow: rgba(0, 0, 0, 0.14) 0px 0px 3px;
      background-color: var(--background-color-3);
      // margin: 20px 0;
      padding: 10px 20px;
      box-sizing: border-box;

      .theme-preview-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
      }

      .theme-preview-tabbar {
        width: 100%;
        height: 35px;
        background-color: var(--background-color-2);
        display: flex;
        border-radius: 5px 5px 0 0;
        justify-content: flex-start;
        position: relative;
        padding: 0 30px;
        box-sizing: border-box;
        overflow: hidden;

        .theme-preview-tabbar-item {
          position: absolute;
          bottom: 0px;
          // max-width: 120px;
          min-width: 100px;
          width: 100px;
          height: 26px;
          flex-shrink: 0;
          // background: var(--background-color-2);
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 8px;
          cursor: pointer;
          gap: 6px;
          border-radius: 6px 6px 0 0;
          // transition: all 0.3s ease;
          user-select: none;
          z-index: 0;

          .closeIcon {
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;

            svg {
              font-size: 10px;
              line-height: 20px;
              cursor: pointer;
              color: var(--text-color-3);
            }
          }

          p {
            margin: 0;
            font-size: 10px;
            color: var(--text-color-3);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
          }

          &.active {
            background: var(--background-color-1);
            box-shadow: 0 0px 6px rgba(0, 0, 0, 0.1);
            z-index: 2;

            p {
              color: var(--text-color-1);
            }

            .closeIcon svg {
              color: var(--text-color-1);
            }
          }

          .pre {
            position: absolute;
            left: -10px;
            top: 17px;
            width: 10px;
            height: 10px;
            fill: var(--background-color-2);
            // transition: all 0.3s ease;

            &.active {
              fill: var(--background-color-1);
            }
          }

          .after {
            position: absolute;
            right: -10px;
            top: 17px;
            width: 10px;
            height: 10px;
            fill: var(--background-color-2);
            // transition: all 0.3s ease;

            &.active {
              fill: var(--background-color-1);
            }
          }
        }

        .addTab {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          gap: 4px;
          flex-shrink: 0;
          min-width: 30px;

          svg {
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
            color: var(--text-color-3);
            padding: 2px 6px;
          }

          .addTabLine {
            width: 0px;
            height: 15px;
            background: var(--border-color-1);
          }
        }
      }

      .theme-preview-content {
        width: 100%;
        height: calc(100% - 30px);
        border-radius: 0 0 5px 5px;
        background-color: var(--background-color-1);
        padding: 20px;
        box-sizing: border-box;
        position: relative;
        z-index: 1;

        .preview-header {
          height: 12px;
          width: 30%;
          background-color: currentColor;
          opacity: 0.7;
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .preview-lines {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 20px;

          .preview-line {
            height: 8px;
            background-color: currentColor;
            opacity: 0.5;
            border-radius: 4px;

            &:nth-child(1) {
              width: 60%;
            }

            &:nth-child(2) {
              width: 55%;
            }

            &:nth-child(3) {
              width: 45%;
            }
          }
        }
      }
    }
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 24px;

    .theme-card {
      background: var(--background-color-2);
      border: 1px solid var(--border-color-2);
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

        .theme-actions {
          opacity: 1;
        }
      }

      &.active {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-color-transparent);
      }

      &.add-custom-theme {
        border-style: dashed;
        border-color: var(--border-color-1);
        position: relative;

        &:hover {
          border-color: var(--primary-color);
          background: var(--hover-background-color);
        }

        &.drag-over {
          border-color: var(--primary-color);
          background: var(--primary-color-transparent);
          transform: scale(1.02);
        }

        .add-custom-preview {
          height: 140px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background-color-1);
          position: relative;

          .add-icon {
            font-size: 48px;
            color: var(--text-color-3);
            font-weight: 300;
            transition: opacity 0.2s;
          }

          .drag-hint-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(74, 144, 226, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            opacity: 0;
            transition: opacity 0.2s;
            border-radius: 6px 6px 0 0;

            .drag-icon {
              width: 32px;
              height: 32px;
              margin-bottom: 8px;
            }

            span {
              font-size: 12px;
              font-weight: 500;
            }
          }

          &:hover .drag-hint-overlay {
            opacity: 1;
          }
        }
      }

      .theme-preview {
        height: 140px;
        width: 100%;
        padding: 12px;

        .preview-content {
          height: 100%;
          border-radius: 4px;
          padding: 8px;

          &.light-preview {
            background-color: rgba(255, 255, 255, 0.85);
            color: #333;
          }

          &.dark-preview {
            background-color: rgba(0, 0, 0, 0.75);
            color: #eee;
          }

          .preview-header {
            height: 12px;
            width: 70%;
            background-color: currentColor;
            opacity: 0.7;
            border-radius: 4px;
            margin-bottom: 12px;
          }

          .preview-lines {
            display: flex;
            flex-direction: column;
            gap: 6px;

            .preview-line {
              height: 8px;
              background-color: currentColor;
              opacity: 0.5;
              border-radius: 4px;

              &:nth-child(1) {
                width: 100%;
              }

              &:nth-child(2) {
                width: 85%;
              }

              &:nth-child(3) {
                width: 65%;
              }
            }
          }
        }
      }

      .theme-info {
        padding: 12px;

        .theme-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;

          h3 {
            font-size: 16px;
            color: var(--text-color);
            margin: 0;
          }

          .theme-actions {
            display: flex;
            gap: 6px;
            align-items: center;

            .edit-btn,
            .download-btn,
            .delete-btn {
              background: none;
              border: none;
              color: var(--text-color-3);
              font-size: 14px;
              cursor: pointer;
              width: 30px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 3px;
              opacity: 0.7;
              transition: all 0.2s ease;

              &:hover {
                background: var(--hover-background-color);
                color: var(--text-color-1);
                opacity: 1;
              }

              svg {
                font-size: 16px;
              }
            }

            .edit-btn:hover {
              color: var(--primary-color);
            }

            .download-btn:hover {
              color: #10b981;
            }

            .delete-btn:hover {
              color: #ef4444;
            }
          }
        }

        h3 {
          font-size: 16px;
          color: var(--text-color);
          margin-bottom: 6px;
        }

        p {
          font-size: 13px;
          color: var(--text-color-2);
          line-height: 1.4;
          margin: 0;
        }
      }

      // 添加主题卡片样式
      &.add-theme-card {
        border: 2px dashed var(--border-color-1);
        background: var(--background-color-1);
        position: relative;
        transition: all 0.3s ease;

        &:hover {
          border-color: var(--primary-color);
          background: var(--hover-background-color);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
        }

        &.drag-over {
          border-color: var(--primary-color);
          background: var(--primary-color-transparent);
          transform: scale(1.02);
          box-shadow: 0 8px 20px rgba(74, 144, 226, 0.2);
        }

        .theme-preview {
          .preview-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: transparent;
            gap: 12px;

            .add-icon {
              width: 48px;
              height: 48px;
              border-radius: 50%;

              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--text-color-1);
              font-size: 24px;
              transition: all 0.3s ease;

              svg {
                font-size: 24px;
              }
            }

            .add-text {
              span {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-color);
              }
            }

            .drag-hint {
              span {
                font-size: 12px;
                color: var(--text-color-2);
                opacity: 0.8;
              }
            }
          }
        }

        .theme-info {
          background: var(--background-color-2);
          border-top: 1px solid var(--border-color-1);

          .theme-title {
            display: flex;
            justify-content: space-between;
            align-items: center;

            h3 {
              color: var(--primary-color);
              font-weight: 600;
            }

            .theme-actions {
              display: flex;
              gap: 4px;
              opacity: 0;
              transition: opacity 0.2s ease;

              .edit-btn,
              .download-btn,
              .delete-btn {
                background: none;
                border: none;
                color: var(--text-color-3);
                cursor: pointer;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                opacity: 0.7;
                transition: all 0.2s ease;

                &:hover {
                  background: var(--hover-background-color);
                  color: var(--text-color-1);
                  opacity: 1;
                }

                .icon {
                  width: 16px;
                  height: 16px;
                  fill: currentColor;
                }
              }

              .edit-btn:hover {
                color: var(--primary-color);
              }

              .download-btn:hover {
                color: #10b981;
              }

              .delete-btn:hover {
                color: #ef4444;
              }
            }
          }

          p {
            color: var(--text-color-2);
          }
        }

        // 拖拽悬停效果
        &::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            var(--primary-color-transparent) 0%,
            transparent 100%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          border-radius: 6px;
        }

        &.drag-over::before {
          opacity: 1;
        }
      }
    }
  }
}

// 通知样式
.theme-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 16px;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  z-index: 10000;
  animation: slideIn 0.3s ease;

  &.success {
    background: #10b981;
  }

  &.error {
    background: #ef4444;
  }
}

// 确认对话框样式
.theme-confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;

  .dialog-content {
    background: var(--background-color-2);
    border: 1px solid var(--border-color-1);
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;

    p {
      margin: 0 0 20px 0;
      color: var(--text-color);
      font-size: 16px;
    }

    .dialog-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;

      button {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;

        &.btn-cancel {
          background: var(--background-color-1);
          color: var(--text-color-2);
          border: 1px solid var(--border-color-1);

          &:hover {
            background: var(--hover-background-color);
            color: var(--text-color-1);
          }
        }

        &.btn-confirm {
          background: var(--primary-color);
          color: white;

          &:hover {
            background: var(--active-color);
          }
        }
      }
    }
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes macaronPulse1 {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.4; }
}

@keyframes macaronPulse2 {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

@keyframes macaronPulse3 {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}
</style>
