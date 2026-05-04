/**
 * Marbymarkdown AI 文本优化插件
 *
 * 支持右键选中文本后，调用 AI 优化文本
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Selection } from "prosemirror-state";

/** AI 优化状态 */
export interface AIOptimizationState {
  decoration: DecorationSet;
  from: number | null;
  to: number | null;
  originalText: string | null;
  loading: boolean;
}

/** AI 优化风格预设 */
export type AIOptimizationStyle = "formal" | "casual" | "concise" | "custom";

/** AI 优化配置 */
export interface AIOptimizationConfig {
  enabled: boolean;
  stylePreset: AIOptimizationStyle;
  customPrompt: string;
  optimize: (text: string, style: AIOptimizationStyle, customPrompt: string) => Promise<string | null>;
}

/** 插件 Key */
export const aiOptimizationPluginKey = new PluginKey<AIOptimizationState>("marbymarkdown-ai-optimization");

let activeAbortController: AbortController | null = null;

/** 执行 AI 优化 */
export function triggerAIOptimization(view: EditorView, configGetter: () => AIOptimizationConfig): boolean {
  console.log("🚀 AI Optimization Triggered!");
  
  const { selection, doc } = view.state;
  if (selection.empty) {
    console.log("❌ No selection, aborting");
    return false;
  }

  const from = selection.from;
  const to = selection.to;
  const originalText = doc.textBetween(from, to, "\n");
  if (!originalText.trim()) {
    console.log("❌ Empty text, aborting");
    return false;
  }

  const config = configGetter();
  if (!config.enabled) {
    console.log("❌ AI Optimization disabled, aborting");
    return false;
  }

  console.log("✅ AI Optimization starting, text length:", originalText.length);

  activeAbortController = new AbortController();

  // 创建底部提示（不遮挡内容）
  const loading = document.createElement("div");
  loading.className = "ai-optimization-loading";
  loading.style.position = "fixed";
  loading.style.bottom = "20px";
  loading.style.left = "20px";
  loading.style.backgroundColor = "var(--background-color, #fff)";
  loading.style.padding = "16px 24px";
  loading.style.borderRadius = "8px";
  loading.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  loading.style.zIndex = "10000";
  loading.style.display = "flex";
  loading.style.alignItems = "center";
  loading.style.gap = "12px";
  loading.style.border = "1px solid var(--border-color, #ddd)";
  
  const loadingIcon = document.createElement("span");
  loadingIcon.textContent = "⏳";
  loadingIcon.style.fontSize = "18px";
  loading.appendChild(loadingIcon);
  
  const loadingText = document.createElement("span");
  loadingText.textContent = "AI 优化中，请稍候...";
  loading.appendChild(loadingText);
  
  document.body.appendChild(loading);

  let optimizationCancelled = false;
  
  // 点击任意地方取消
  const handleClickOutside = () => {
    console.log("👆 Click outside detected, cancelling optimization");
    optimizationCancelled = true;
    if (activeAbortController) {
      activeAbortController.abort();
    }
    cleanup();
  };
  
  document.addEventListener("mousedown", handleClickOutside);
  
  // 监听选区变化也取消
  const handleSelectionChange = () => {
    console.log("🔄 Selection changed, cancelling optimization");
    optimizationCancelled = true;
    if (activeAbortController) {
      activeAbortController.abort();
    }
    cleanup();
  };
  
  document.addEventListener("selectionchange", handleSelectionChange);

  function cleanup() {
    if (loading.parentNode) {
      loading.parentNode.removeChild(loading);
    }
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("selectionchange", handleSelectionChange);
  }

  (async () => {
    try {
      console.log("📤 Calling AI optimize function...");
      const optimizedText = await config.optimize(
        originalText,
        config.stylePreset,
        config.customPrompt
      );
      console.log("📥 AI returned:", optimizedText);

      if (optimizationCancelled) {
        console.log("⚠️ Optimization already cancelled, skipping");
        return;
      }

      if (optimizedText) {
        const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(optimizedText));
        tr.setSelection(Selection.near(tr.doc.resolve(from + optimizedText.length)));
        view.dispatch(tr);
      }

      cleanup();
    } catch (e) {
      console.error("❌ AI Optimization failed", e);
      if (!optimizationCancelled) {
        cleanup();
      }
    }
  })();

  return true;
}

/**
 * 创建 AI 优化插件
 */
export function createAIOptimizationPlugin(getConfig: () => AIOptimizationConfig): Plugin {
  return new Plugin<AIOptimizationState>({
    key: aiOptimizationPluginKey,

    state: {
      init() {
        return { decoration: DecorationSet.empty, from: null, to: null, originalText: null, loading: false };
      },
      apply(tr, value) {
        const meta = tr.getMeta(aiOptimizationPluginKey);
        if (meta) {
          return meta;
        }
        return value;
      },
    },

    props: {
      decorations(state) {
        return this.getState(state)?.decoration;
      },
    },

    view(view) {
      (aiOptimizationPluginKey as any).configGetter = getConfig;
      return {};
    },
  });
}
