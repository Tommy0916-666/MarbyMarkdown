/**
 * Marbymarkdown AI 续写插件
 *
 * 基于 ProseMirror 的 AI 自动续写功能
 * 在用户停止输入后自动调用 AI 服务生成续写建议
 * 按 Tab 键接受建议
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";

/** AI 续写插件状态 */
export interface AICompletionState {
  decoration: DecorationSet;
  suggestion: string | null;
  loading: boolean;
}

/** AI 续写模式 */
export type AICompletionMode = "auto" | "manual";

/** AI 配置 */
export interface AICompletionConfig {
  enabled: boolean;
  mode: AICompletionMode;
  debounceWait: number;
  // AI 服务调用函数
  complete: (context: AICompletionContext) => Promise<{ continuation: string } | null>;
}

/** AI 续写上下文 */
export interface AICompletionContext {
  fileTitle: string;
  previousContent: string;
  sectionTitle: string;
  subSectionTitle: string;
}

/** 插件 Key */
export const aiCompletionPluginKey = new PluginKey<AICompletionState>("marbymarkdown-ai-completion");

/** 接受 AI 续写的命令 */
export function acceptAICompletion(view: EditorView): boolean {
  console.log("✅ Accepting AI Completion!");
  const state = aiCompletionPluginKey.getState(view.state);
  if (state?.suggestion) {
    const tr = view.state.tr.insertText(state.suggestion, view.state.selection.to);
    tr.setMeta(aiCompletionPluginKey, {
      decoration: DecorationSet.empty,
      suggestion: null,
      loading: false,
    });
    view.dispatch(tr);
    return true;
  }
  return false;
}

/** 手动触发 AI 续写的命令 */
export function triggerAICompletion(view: EditorView): boolean {
  console.log("🚀 AI Completion Triggered!");
  
  const configGetter = (aiCompletionPluginKey as any).configGetter;
  if (!configGetter) {
    console.log("❌ No config getter found");
    return false;
  }
  
  const config = configGetter();
  if (!config.enabled) {
    console.log("❌ AI Completion disabled");
    return false;
  }
  
  const { selection, doc } = view.state;
  const { to } = selection;
  
  if (!selection.empty) {
    console.log("❌ Has selection, not triggering");
    return false;
  }
  
  console.log("✅ Starting AI Completion, position:", to);
  
  // 获取上下文
  const fileTitle = (window as any).__currentFilePath
    ? (window as any).__currentFilePath.split(/[\\/]/).pop()
    : "未命名文档";

  const start = Math.max(0, to - 200);
  const previousContent = doc.textBetween(start, to, "\n");

  let sectionTitle = "未知";
  let subSectionTitle = "未知";
  const headers: { level: number; text: string }[] = [];

  doc.nodesBetween(0, to, (node, pos) => {
    if (node.type.name === "heading") {
      if (pos + node.nodeSize <= to) {
        headers.push({ level: node.attrs.level, text: node.textContent });
      }
      return false;
    }
    if (
      ["paragraph", "code_block", "blockquote", "bullet_list", "ordered_list"].includes(
        node.type.name
      )
    ) {
      return false;
    }
    return true;
  });

  if (headers.length > 0) {
    const lastHeader = headers[headers.length - 1];
    subSectionTitle = lastHeader.text;

    const parentHeader = headers
      .slice(0, -1)
      .reverse()
      .find((h) => h.level < lastHeader.level);

    if (parentHeader) {
      sectionTitle = parentHeader.text;
    } else {
      const mainHeader =
        headers.find((h) => h.level === 1) || headers.find((h) => h.level === 2);
      if (mainHeader && mainHeader !== lastHeader) {
        sectionTitle = mainHeader.text;
      } else if (lastHeader.level <= 2) {
        sectionTitle = lastHeader.text;
      }
    }
  }

  console.log("📊 AI Context:", { fileTitle, sectionTitle, subSectionTitle, previousContent: previousContent.substring(0, 50) + "..." });

  // 显示加载状态
  const loadingWidget = document.createElement("span");
  loadingWidget.textContent = "续写中...";
  loadingWidget.style.color = "var(--text-color-light, #999)";
  loadingWidget.style.opacity = "0.6";
  loadingWidget.style.pointerEvents = "none";
  const loadingDeco = Decoration.widget(to, loadingWidget, { side: 1 });
  const loadingDecoSet = DecorationSet.create(doc, [loadingDeco]);
  const loadingTr = view.state.tr.setMeta(aiCompletionPluginKey, {
    decoration: loadingDecoSet,
    suggestion: null,
    loading: true,
  });
  view.dispatch(loadingTr);

  (async () => {
    try {
      console.log("📤 Calling AI complete function...");
      const result = await config.complete({
        fileTitle,
        previousContent,
        sectionTitle,
        subSectionTitle,
      });
      console.log("📥 AI returned:", result);

      if (result && result.continuation) {
        const widget = document.createElement("span");
        widget.textContent = result.continuation;
        widget.style.color = "var(--text-color-light, #999)";
        widget.style.opacity = "0.6";
        widget.style.pointerEvents = "none";
        widget.dataset.suggestion = result.continuation;

        const deco = Decoration.widget(to, widget, { side: 1 });
        const decoSet = DecorationSet.create(doc, [deco]);

        const tr = view.state.tr.setMeta(aiCompletionPluginKey, {
          decoration: decoSet,
          suggestion: result.continuation,
          loading: false,
        });
        view.dispatch(tr);
      } else {
        // 没有结果，清除加载状态
        const clearTr = view.state.tr.setMeta(aiCompletionPluginKey, {
          decoration: DecorationSet.empty,
          suggestion: null,
          loading: false,
        });
        view.dispatch(clearTr);
      }
    } catch (e) {
      console.error("❌ AI Completion failed", e);
      // 出错时清除加载状态
      const clearTr = view.state.tr.setMeta(aiCompletionPluginKey, {
        decoration: DecorationSet.empty,
        suggestion: null,
        loading: false,
      });
      view.dispatch(clearTr);
    }
  })();

  return true;
}

/**
 * 创建 AI 续写插件
 */
export function createAICompletionPlugin(getConfig: () => AICompletionConfig): Plugin {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let configGetter: () => AICompletionConfig = getConfig;

  return new Plugin<AICompletionState>({
    key: aiCompletionPluginKey,

    state: {
      init() {
        return { decoration: DecorationSet.empty, suggestion: null, loading: false };
      },
      apply(tr, value) {
        // 文档变化时清除建议
        if (tr.docChanged) {
          return { decoration: DecorationSet.empty, suggestion: null, loading: false };
        }
        // 手动更新（如异步获取结果后）
        const meta = tr.getMeta(aiCompletionPluginKey);
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

      handleKeyDown(view, event) {
        if (event.key === "Tab") {
          const state = this.getState(view.state);
          if (state?.suggestion) {
            event.preventDefault();
            const tr = view.state.tr.insertText(state.suggestion, view.state.selection.to);
            // 清除建议
            tr.setMeta(aiCompletionPluginKey, {
              decoration: DecorationSet.empty,
              suggestion: null,
              loading: false,
            });
            view.dispatch(tr);
            return true;
          }
        }
        return false;
      },
    },

    view(_view) {
      (aiCompletionPluginKey as any).configGetter = configGetter;
      
      return {
        update: (view: EditorView, prevState) => {
          const config = getConfig();
          console.log("🔍 AI Completion plugin update, enabled:", config.enabled, "mode:", config.mode);

          // 如果禁用，不做任何事
          if (!config.enabled) return;

          // 如果是手动模式，不自动触发
          if (config.mode !== "auto") {
            console.log("ℹ️ Manual mode, skipping auto-trigger");
            return;
          }

          // 如果文档没有变化，忽略
          if (!view.state.doc.eq(prevState.doc)) {
            console.log("📄 Document changed, setting timer");
            if (timer) clearTimeout(timer);

            timer = setTimeout(async () => {
              console.log("⏱️ Timer triggered");
              const { selection, doc } = view.state;
              const { to } = selection;

              // 如果有选区（范围选择），不触发
              if (!selection.empty) {
                console.log("❌ Has selection, not triggering");
                return;
              }

              // 获取上下文
              const fileTitle = (window as any).__currentFilePath
                ? (window as any).__currentFilePath.split(/[\\/]/).pop()
                : "未命名文档";

              // 获取前面的文本
              const start = Math.max(0, to - 200);
              const previousContent = doc.textBetween(start, to, "\n");

              // 提取标题上下文
              let sectionTitle = "未知";
              let subSectionTitle = "未知";

              const headers: { level: number; text: string }[] = [];

              doc.nodesBetween(0, to, (node, pos) => {
                if (node.type.name === "heading") {
                  if (pos + node.nodeSize <= to) {
                    headers.push({ level: node.attrs.level, text: node.textContent });
                  }
                  return false;
                }
                if (
                  ["paragraph", "code_block", "blockquote", "bullet_list", "ordered_list"].includes(
                    node.type.name
                  )
                ) {
                  return false;
                }
                return true;
              });

              if (headers.length > 0) {
                const lastHeader = headers[headers.length - 1];
                subSectionTitle = lastHeader.text;

                const parentHeader = headers
                  .slice(0, -1)
                  .reverse()
                  .find((h) => h.level < lastHeader.level);

                if (parentHeader) {
                  sectionTitle = parentHeader.text;
                } else {
                  const mainHeader =
                    headers.find((h) => h.level === 1) || headers.find((h) => h.level === 2);
                  if (mainHeader && mainHeader !== lastHeader) {
                    sectionTitle = mainHeader.text;
                  } else if (lastHeader.level <= 2) {
                    sectionTitle = lastHeader.text;
                  }
                }
              }

              console.log("📊 AI Context:", { fileTitle, sectionTitle, subSectionTitle, previousContent: previousContent.substring(0, 50) + "..." });

              // 上下文太短，不触发
              if (previousContent.trim().length < 5) {
                console.log("❌ Content too short, not triggering");
                return;
              }

              // 显示加载状态
              console.log("📡 Showing loading widget...");
              const loadingWidget = document.createElement("span");
              loadingWidget.textContent = "续写中...";
              loadingWidget.style.color = "var(--text-color-light, #999)";
              loadingWidget.style.opacity = "0.6";
              loadingWidget.style.pointerEvents = "none";
              const loadingDeco = Decoration.widget(to, loadingWidget, { side: 1 });
              const loadingDecoSet = DecorationSet.create(doc, [loadingDeco]);
              const loadingTr = view.state.tr.setMeta(aiCompletionPluginKey, {
                decoration: loadingDecoSet,
                suggestion: null,
                loading: true,
              });
              view.dispatch(loadingTr);

              try {
                console.log("📤 Calling AI complete function...");
                const result = await config.complete({
                  fileTitle,
                  previousContent,
                  sectionTitle,
                  subSectionTitle,
                });
                console.log("📥 AI returned:", result);

                if (result && result.continuation) {
                  const widget = document.createElement("span");
                  widget.textContent = result.continuation;
                  widget.style.color = "var(--text-color-light, #999)";
                  widget.style.opacity = "0.6";
                  widget.style.pointerEvents = "none";
                  widget.dataset.suggestion = result.continuation;

                  const deco = Decoration.widget(to, widget, { side: 1 });
                  const decoSet = DecorationSet.create(doc, [deco]);

                  const tr = view.state.tr.setMeta(aiCompletionPluginKey, {
                    decoration: decoSet,
                    suggestion: result.continuation,
                    loading: false,
                  });
                  view.dispatch(tr);
                } else {
                  const clearTr = view.state.tr.setMeta(aiCompletionPluginKey, {
                    decoration: DecorationSet.empty,
                    suggestion: null,
                    loading: false,
                  });
                  view.dispatch(clearTr);
                }
              } catch (e) {
                console.error("❌ AI Completion failed", e);
                const clearTr = view.state.tr.setMeta(aiCompletionPluginKey, {
                  decoration: DecorationSet.empty,
                  suggestion: null,
                  loading: false,
                });
                view.dispatch(clearTr);
              }
            }, config.debounceWait || 2000);
          }
        },

        destroy() {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        },
      };
    },
  });
}
