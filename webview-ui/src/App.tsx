import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { LivemarkEditor } from "./editor/LivemarkEditor";
import { Toolbar } from "./components/Toolbar";
import { ModeToggle } from "./components/ModeToggle";
import { useVSCodeMessaging } from "./hooks/useVSCodeMessaging";
import { useEditorContent } from "./hooks/useEditorContent";
import { useTheme } from "./hooks/useTheme";
import { serializeMarkdown } from "./editor/serialization/markdownSerializer";
import type { ExtensionMessage } from "./messages";

export const App: React.FC = () => {
  const editorRef = useRef<Editor | null>(null);
  const pendingContent = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [baseUri, setBaseUri] = useState<string | undefined>(undefined);
  const { applyTheme } = useTheme();

  const { postMessage } = useVSCodeMessaging(
    useCallback(
      (message: ExtensionMessage) => {
        switch (message.type) {
          case "ext:init": {
            applyTheme(message.theme);
            setBaseUri(message.baseUri);
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
                .setImage({ src: message.relativePath })
                .run();
            }
            break;
          }
          case "ext:executeCommand": {
            handleCommand(message.command);
            break;
          }
        }
      },
      [isSourceMode]
    )
  );

  const { loadContent, handleUpdate } = useEditorContent({
    postMessage,
    baseUri,
  });

  // Signal ready on mount
  useEffect(() => {
    postMessage({ type: "webview:ready" });
  }, [postMessage]);

  const handleEditorReady = useCallback(
    (editor: Editor) => {
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

  const handleCommand = useCallback(
    (command: string) => {
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
        case "toggleSourceMode":
          toggleSourceMode();
          break;
      }
    },
    []
  );

  const toggleSourceMode = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (isSourceMode) {
      // Switch back to rendered mode - parse source text
      loadContent(editor, sourceText);
      setIsSourceMode(false);
    } else {
      // Switch to source mode - serialize current content
      const text = serializeMarkdown(editor.getJSON());
      setSourceText(text);
      setIsSourceMode(true);
    }
  }, [isSourceMode, sourceText, loadContent]);

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setSourceText(text);
      postMessage({ type: "webview:contentChanged", text });
    },
    [postMessage]
  );

  if (!isReady) {
    return <div className="livemark-loading">Loading...</div>;
  }

  return (
    <div className="livemark-container">
      <div className="livemark-toolbar">
        {!isSourceMode && <Toolbar editor={editorRef.current} />}
        <ModeToggle isSourceMode={isSourceMode} onToggle={toggleSourceMode} />
      </div>
      <div className="livemark-editor-area">
        {isSourceMode ? (
          <textarea
            className="livemark-source-editor"
            value={sourceText}
            onChange={handleSourceChange}
            spellCheck={false}
          />
        ) : (
          <LivemarkEditor
            onUpdate={handleUpdate}
            onReady={handleEditorReady}
            onImagePaste={handleImagePaste}
            onLinkClick={handleLinkClick}
            editorRef={editorRef}
          />
        )}
      </div>
    </div>
  );
};
