import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";

// ---------------------------------------------------------------------------
// Cursor synchronisation helpers (rendered ↔ source)
// ---------------------------------------------------------------------------

/**
 * Returns all plain text before the TipTap cursor, with block boundaries
 * joined by newlines so it matches what the markdown serializer emits.
 */
function getTextBeforeTiptapCursor(editor: Editor): string {
  const { anchor } = editor.state.selection;
  // \uFFFC = object-replacement character used as placeholder for non-text nodes
  return editor.state.doc.textBetween(0, anchor, "\n", "\uFFFC");
}

/**
 * Given the plain text before the cursor in the rendered view, finds the
 * best-matching position in the markdown string by searching for successively
 * shorter suffixes until one is found verbatim in the markdown.
 */
function findMarkdownPosFromPlainText(plainTextBefore: string, markdown: string): number {
  if (!plainTextBefore) return 0;
  const maxLen = Math.min(plainTextBefore.length, 60);
  for (let len = maxLen; len >= 1; len--) {
    const needle = plainTextBefore.slice(-len);
    const idx = markdown.lastIndexOf(needle);
    if (idx !== -1) return idx + needle.length;
  }
  return 0;
}

/**
 * Strip common markdown block/inline syntax to approximate plain text.
 * Used to generate a search needle for suffix-matching against TipTap text.
 */
function stripMarkdownSyntax(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/^```\w*\n?/, "").replace(/\n?```$/, ""))
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/~~(.+?)~~/gs, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/!\[.*?\]\([^)]*\)/g, "")
    .replace(/\[(.+?)\]\([^)]*\)/g, "$1")
    .replace(/\n{2,}/g, "\n");
}

/**
 * Given a text offset in the flat string produced by `doc.textBetween`,
 * binary-search for the corresponding ProseMirror position.
 */
function textOffsetToPmPos(editor: Editor, targetOffset: number): number {
  const doc = editor.state.doc;
  let lo = 0;
  let hi = doc.content.size;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (doc.textBetween(0, mid, "\n", "\uFFFC").length < targetOffset) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Map a source-textarea cursor position to a ProseMirror position.
 * Strips markdown from text before the cursor, then suffix-matches
 * against TipTap's plain text to find the equivalent position.
 */
function findTiptapPosFromSourceCursor(
  editor: Editor,
  markdown: string,
  cursorPos: number
): number {
  const doc = editor.state.doc;
  const fullText = doc.textBetween(0, doc.content.size, "\n", "\uFFFC");
  const plainBefore = stripMarkdownSyntax(markdown.slice(0, cursorPos));

  const maxLen = Math.min(plainBefore.length, 60);
  for (let len = maxLen; len >= 1; len--) {
    const needle = plainBefore.slice(-len);
    const idx = fullText.lastIndexOf(needle);
    if (idx !== -1) {
      return textOffsetToPmPos(editor, idx + needle.length);
    }
  }
  // Fallback: start of document
  return 1;
}
// ---------------------------------------------------------------------------
import { LivemarkEditor } from "./editor/LivemarkEditor";
import { Toolbar } from "./components/Toolbar";
import { ModeToggle } from "./components/ModeToggle";
import { LayoutSelector } from "./components/LayoutSelector";
import { ResizeHandles } from "./components/ResizeHandles";
import { useVSCodeMessaging } from "./hooks/useVSCodeMessaging";
import { useEditorContent } from "./hooks/useEditorContent";
import { useTheme } from "./hooks/useTheme";
import { serializeMarkdown } from "./editor/serialization/markdownSerializer";
import { resolveImageUrl } from "./editor/serialization/mdastToTiptap";
import { plantumlServerUrl } from "./editor/extensions/plantumlEncode";
import type { ExtensionMessage } from "./messages";

export const App: React.FC = () => {
  const editorRef = useRef<Editor | null>(null);
  const pendingContent = useRef<string | null>(null);
  const shouldFocusEditorRef = useRef<"start" | "default" | false>(false);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingTextareaCursor = useRef<number | null>(null);
  const pendingSourceCursor = useRef<{ markdown: string; pos: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const isSourceModeRef = useRef(false);
  const [sourceText, setSourceText] = useState("");
  const [baseUri, setBaseUri] = useState<string | undefined>(undefined);
  const [version, setVersion] = useState<string>("");
  const [alignment, setAlignment] = useState<string>("center");
  const [width, setWidth] = useState<string>("compact");
  const [contentWidth, setContentWidth] = useState<number>(800);
  const [toolbarContextMode, setToolbarContextMode] = useState<string>("disable");
  const [showLayoutControls, setShowLayoutControls] = useState<boolean>(true);
  const [plantumlServer, setPlantumlServer] = useState<string>("https://www.plantuml.com/plantuml");
  const plantumlServerRef = useRef<string>("https://www.plantuml.com/plantuml");
  const baseUriRef = useRef<string | undefined>(undefined);
  const { applyTheme } = useTheme();

  // Keep a ref to the latest toggleSourceMode so handleCommand never has a stale closure
  const toggleSourceModeRef = useRef<() => void>(() => {});

  const { postMessage } = useVSCodeMessaging(
    useCallback(
      (message: ExtensionMessage) => {
        switch (message.type) {
          case "ext:init": {
            applyTheme(message.theme);
            setBaseUri(message.baseUri);
            baseUriRef.current = message.baseUri;
            setVersion(message.version ?? "");
            setAlignment(message.alignment || "center");
            setWidth(message.width || "compact");
            setContentWidth(message.contentWidth || 800);
            setToolbarContextMode(message.toolbarContextMode || "disable");
            setShowLayoutControls(message.showLayoutControls !== false);
            const server = message.plantumlServer || "https://www.plantuml.com/plantuml";
            setPlantumlServer(server);
            plantumlServerRef.current = server;
            setSourceText(message.text);
            shouldFocusEditorRef.current = "start";
            if (editorRef.current) {
              loadContent(editorRef.current, message.text);
              setTimeout(() => editorRef.current?.commands.focus("start"), 0);
              shouldFocusEditorRef.current = false;
            } else {
              // Editor not mounted yet - store for when it's ready
              pendingContent.current = message.text;
            }
            setIsReady(true);
            break;
          }
          case "ext:documentChanged": {
            if (isSourceMode) {
              setSourceText(message.text);
            } else if (editorRef.current) {
              loadContent(editorRef.current, message.text);
            }
            break;
          }
          case "ext:themeChanged": {
            applyTheme(message.theme);
            break;
          }
          case "ext:imageSaved": {
            if (editorRef.current) {
              editorRef.current
                .chain()
                .focus()
                .insertContent({
                  type: "image",
                  attrs: {
                    src: resolveImageUrl(
                      message.relativePath,
                      baseUriRef.current
                    ),
                    originalSrc: message.relativePath,
                  },
                })
                .run();
            }
            break;
          }
          case "ext:executeCommand": {
            handleCommand(message.command);
            break;
          }
          case "ext:layoutChanged": {
            setAlignment(message.alignment);
            setWidth(message.width);
            setContentWidth(message.contentWidth);
            setToolbarContextMode(message.toolbarContextMode || "disable");
            setShowLayoutControls(message.showLayoutControls !== false);
            break;
          }
          case "ext:requestHtmlExport": {
            // Async work runs in a void IIFE because the callback is synchronous
            void (async () => {
              // Get HTML from the editor with original image paths
              if (editorRef.current) {
                // Get JSON and convert to HTML with originalSrc preserved
                const json = editorRef.current.getJSON();
                const html = editorRef.current.getHTML();

                // Capture the actual rendered DOM — this contains PlantUML as
                // real <img> tags, syntax-highlighted code, figure+figcaption
                // for images, etc. The extension uses this for a pixel-perfect
                // export that looks exactly like the rendered view.
                const editorEl = document.querySelector(".livemark-editor-content") as HTMLElement | null;
                const domHtml = editorEl?.innerHTML ?? undefined;

                // Current theme so the exported CSS can match the editor's look
                const theme = (document.documentElement.getAttribute("data-theme") ?? "light") as
                  | "light"
                  | "dark"
                  | "high-contrast"
                  | "high-contrast-light";

                // Collect plantuml blocks and their rendered server URLs so the
                // extension can embed the actual diagrams in the exported HTML.
                const plantumlBlocks: Array<{ source: string; url: string }> = [];
                const collectPlantuml = async (node: any) => {
                  if (node.type === "plantumlBlock" && node.attrs?.source) {
                    try {
                      const url = await plantumlServerUrl(
                        node.attrs.source as string,
                        plantumlServerRef.current
                      );
                      plantumlBlocks.push({ source: node.attrs.source as string, url });
                    } catch {
                      // skip blocks that fail to encode
                    }
                  }
                  if (node.content) {
                    for (const child of node.content) {
                      await collectPlantuml(child);
                    }
                  }
                };
                await collectPlantuml(json);

                // Send both JSON and HTML so extension can extract image paths
                postMessage({
                  type: "webview:htmlExport",
                  html,
                  json: JSON.stringify(json),
                  domHtml,
                  theme,
                  plantumlBlocks: plantumlBlocks.length > 0 ? plantumlBlocks : undefined,
                });
              }
            })();
            break;
          }
        }
      },
      [isSourceMode]
    )
  );

  const { loadContent, handleUpdate, flush } = useEditorContent({
    postMessage,
    baseUri,
  });

  // Signal ready on mount
  useEffect(() => {
    postMessage({ type: "webview:ready" });
  }, [postMessage]);

  const handleEditorReady = useCallback(
    (editor: Editor) => {
      setEditorInstance(editor);
      if (pendingContent.current !== null) {
        loadContent(editor, pendingContent.current);
        pendingContent.current = null;
      }
      if (pendingSourceCursor.current !== null) {
        const { markdown, pos: srcPos } = pendingSourceCursor.current;
        pendingSourceCursor.current = null;
        setTimeout(() => {
          if (!editor.isDestroyed) {
            const pos = findTiptapPosFromSourceCursor(editor, markdown, srcPos);
            editor.chain().focus().setTextSelection(pos).run();
          }
        }, 0);
      } else if (shouldFocusEditorRef.current) {
        const focusPos = shouldFocusEditorRef.current;
        shouldFocusEditorRef.current = false;
        // Defer focus so TipTap finishes its own initialization first
        setTimeout(() => editor.commands.focus(focusPos === "start" ? "start" : undefined), 0);
      }
    },
    [loadContent]
  );

  const handleImagePaste = useCallback(
    (base64: string, fileName: string) => {
      postMessage({ type: "webview:pasteImage", base64, fileName });
    },
    [postMessage]
  );

  const handleLinkClick = useCallback(
    (href: string) => {
      postMessage({ type: "webview:openLink", href });
    },
    [postMessage]
  );

  const handleDeleteImage = useCallback(
    (imagePath: string) => {
      postMessage({ type: "webview:deleteImage", imagePath });
    },
    [postMessage]
  );

  const handleOpenImage = useCallback(
    (imagePath: string) => {
      postMessage({ type: "webview:openImage", imagePath });
    },
    [postMessage]
  );

  const handleCommand = useCallback(
    (command: string) => {
      // toggleSourceMode always works, regardless of mode
      if (command === "toggleSourceMode") {
        toggleSourceModeRef.current();
        return;
      }

      // All other commands require the TipTap editor (rendered mode)
      if (isSourceModeRef.current) return;

      const editor = editorRef.current;
      if (!editor) return;

      switch (command) {
        case "toggleBold":
          editor.chain().focus().toggleBold().run();
          break;
        case "toggleItalic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "toggleStrike":
          editor.chain().focus().toggleStrike().run();
          break;
        case "toggleCode":
          editor.chain().focus().toggleCode().run();
          break;
        case "setHeading1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "setHeading2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "setHeading3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "setHeading4":
          editor.chain().focus().toggleHeading({ level: 4 }).run();
          break;
        case "setHeading5":
          editor.chain().focus().toggleHeading({ level: 5 }).run();
          break;
        case "setHeading6":
          editor.chain().focus().toggleHeading({ level: 6 }).run();
          break;
        case "increaseHeadingLevel": {
          // If paragraph -> H1, if H1 -> H2, ..., if H5 -> H6, if H6 -> stay
          for (let i = 5; i >= 1; i--) {
            if (editor.isActive("heading", { level: i })) {
              editor
                .chain()
                .focus()
                .toggleHeading({ level: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 })
                .run();
              return;
            }
          }
          if (editor.isActive("heading", { level: 6 })) return; // already H6
          // It's a paragraph - make it H1
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        }
        case "decreaseHeadingLevel": {
          // If H1 -> paragraph, if H2 -> H1, ..., if H6 -> H5, if paragraph -> stay
          for (let i = 2; i <= 6; i++) {
            if (editor.isActive("heading", { level: i })) {
              editor
                .chain()
                .focus()
                .toggleHeading({ level: (i - 1) as 1 | 2 | 3 | 4 | 5 | 6 })
                .run();
              return;
            }
          }
          if (editor.isActive("heading", { level: 1 })) {
            editor.chain().focus().setParagraph().run();
          }
          break;
        }
      }
    },
    [] // Refs avoid stale closures
  );

  const toggleSourceMode = useCallback(() => {
    if (isSourceMode) {
      // Switch back to rendered mode - the editor will remount and load content via handleEditorReady
      const editor = editorRef.current;
      // Capture textarea cursor and map to TipTap plain-text count
      const taEl = sourceTextareaRef.current;
      if (taEl) {
        pendingSourceCursor.current = { markdown: sourceText, pos: taEl.selectionStart };
      } else {
        shouldFocusEditorRef.current = "default"; // fallback
      }
      if (editor) {
        loadContent(editor, sourceText);
      } else {
        // Editor was unmounted while in source mode; store content as pending
        pendingContent.current = sourceText;
      }
      setIsSourceMode(false);
    } else {
      const editor = editorRef.current;
      if (!editor) return;
      // Switch to source mode - serialize current content
      const text = serializeMarkdown(editor.getJSON(), baseUriRef.current);
      // Capture TipTap cursor and map to markdown string position
      const textBefore = getTextBeforeTiptapCursor(editor);
      pendingTextareaCursor.current = findMarkdownPosFromPlainText(textBefore, text);
      setSourceText(text);
      setIsSourceMode(true);
    }
  }, [isSourceMode, sourceText, loadContent]);

  // Keep ref in sync with latest toggleSourceMode
  useEffect(() => {
    toggleSourceModeRef.current = toggleSourceMode;
  }, [toggleSourceMode]);

  // Keep source mode ref in sync
  useEffect(() => {
    isSourceModeRef.current = isSourceMode;
  }, [isSourceMode]);

  const sourceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setSourceText(text);
      if (sourceDebounceRef.current) {
        clearTimeout(sourceDebounceRef.current);
      }
      sourceDebounceRef.current = setTimeout(() => {
        sourceDebounceRef.current = null;
        postMessage({ type: "webview:contentChanged", text });
      }, 300);
    },
    [postMessage]
  );

  const handleAlignmentChange = useCallback(
    (newAlignment: string) => {
      setAlignment(newAlignment);
      postMessage({ type: "webview:setLayout", alignment: newAlignment });
    },
    [postMessage]
  );

  const handleWidthChange = useCallback(
    (newWidth: string) => {
      setWidth(newWidth);
      postMessage({ type: "webview:setLayout", width: newWidth });
    },
    [postMessage]
  );

  const handleContentWidthChange = useCallback((newWidth: number) => {
    setContentWidth(newWidth);
  }, []);

  const handleContentWidthResizeEnd = useCallback(
    (newWidth: number) => {
      postMessage({
        type: "webview:setLayout",
        contentWidth: newWidth,
      });
    },
    [postMessage]
  );

  if (!isReady) {
    return <div className="livemark-loading">Loading...</div>;
  }

  return (
    <div className="livemark-container">
      <div className="livemark-toolbar">
        {!isSourceMode && <Toolbar editor={editorInstance} toolbarContextMode={toolbarContextMode} />}
        {!isSourceMode && showLayoutControls && (
          <>
            <span className="livemark-toolbar-separator" />
            <LayoutSelector
              alignment={alignment}
              width={width}
              onAlignmentChange={handleAlignmentChange}
              onWidthChange={handleWidthChange}
            />
          </>
        )}
        {version && <span className="livemark-version">v{version}</span>}
        <ModeToggle isSourceMode={isSourceMode} onToggle={toggleSourceMode} />
      </div>
      <div
        className="livemark-editor-area"
        data-alignment={alignment}
        data-width={width}
        style={
          width === "resizable"
            ? ({ "--livemark-content-width": `${contentWidth}px` } as React.CSSProperties)
            : undefined
        }
      >
        {isSourceMode ? (
          <textarea
            ref={(el) => {
              sourceTextareaRef.current = el;
              if (el) {
                el.focus();
                if (pendingTextareaCursor.current !== null) {
                  const pos = pendingTextareaCursor.current;
                  pendingTextareaCursor.current = null;
                  el.selectionStart = el.selectionEnd = pos;
                }
              }
            }}
            className="livemark-source-editor"
            value={sourceText}
            onChange={handleSourceChange}
            spellCheck={false}
          />
        ) : (
          <>
            <LivemarkEditor
              onUpdate={handleUpdate}
              onReady={handleEditorReady}
              onImagePaste={handleImagePaste}
              onLinkClick={handleLinkClick}
              onDeleteImage={handleDeleteImage}
              onOpenImage={handleOpenImage}
              editorRef={editorRef}
              plantumlServer={plantumlServer}
            />
            {width === "resizable" && (
              <ResizeHandles
                contentWidth={contentWidth}
                onWidthChange={handleContentWidthChange}
                onResizeEnd={handleContentWidthResizeEnd}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
