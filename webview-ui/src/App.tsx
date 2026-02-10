import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";
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
import type { ExtensionMessage } from "./messages";

export const App: React.FC = () => {
  const editorRef = useRef<Editor | null>(null);
  const pendingContent = useRef<string | null>(null);
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
            setSourceText(message.text);
            if (editorRef.current) {
              loadContent(editorRef.current, message.text);
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
        case "toggleSourceMode":
          // Handled above, before the editor check
          break;
      }
    },
    [] // Refs avoid stale closures
  );

  const toggleSourceMode = useCallback(() => {
    if (isSourceMode) {
      // Switch back to rendered mode - the editor will remount and load content via handleEditorReady
      const editor = editorRef.current;
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
      const text = serializeMarkdown(editor.getJSON());
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

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setSourceText(text);
      postMessage({ type: "webview:contentChanged", text });
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
        {!isSourceMode && <Toolbar editor={editorInstance} />}
        {!isSourceMode && (
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
