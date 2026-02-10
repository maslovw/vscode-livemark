import { useRef, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { parseMarkdown } from "../editor/serialization/markdownParser";
import { serializeMarkdown } from "../editor/serialization/markdownSerializer";
import type { WebviewMessage } from "../messages";

const DEBOUNCE_MS = 300;

interface UseEditorContentOptions {
  postMessage: (msg: WebviewMessage) => void;
  baseUri?: string;
}

export function useEditorContent({
  postMessage,
  baseUri,
}: UseEditorContentOptions) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressUpdateCount = useRef(0);
  const lastSentText = useRef<string>("");
  const baseUriRef = useRef<string | undefined>(baseUri);
  const editorRef = useRef<Editor | null>(null);
  const postMessageRef = useRef(postMessage);
  baseUriRef.current = baseUri;
  postMessageRef.current = postMessage;

  /** Immediately send any pending debounced content. Safe to call multiple times. */
  const flush = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const text = serializeMarkdown(editor.getJSON(), baseUriRef.current);
    if (text !== lastSentText.current) {
      lastSentText.current = text;
      postMessageRef.current({ type: "webview:contentChanged", text });
    }
  }, []);

  // Flush pending content on beforeunload (tab close / webview dispose)
  useEffect(() => {
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Also flush on React unmount
      flush();
    };
  }, [flush]);

  const loadContent = useCallback(
    (editor: Editor | null, markdown: string) => {
      if (!editor) return;
      editorRef.current = editor;
      suppressUpdateCount.current++;
      lastSentText.current = markdown;
      const doc = parseMarkdown(markdown, baseUriRef.current);
      editor.commands.setContent(doc);
    },
    []
  );

  const handleUpdate = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      if (suppressUpdateCount.current > 0) {
        suppressUpdateCount.current--;
        return;
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        const text = serializeMarkdown(editor.getJSON(), baseUriRef.current);
        if (text !== lastSentText.current) {
          lastSentText.current = text;
          postMessage({ type: "webview:contentChanged", text });
        }
      }, DEBOUNCE_MS);
    },
    [postMessage]
  );

  return { loadContent, handleUpdate, flush };
}
