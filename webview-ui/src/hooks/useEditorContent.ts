import { useRef, useCallback } from "react";
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
  const suppressNextUpdate = useRef(false);
  const lastSentText = useRef<string>("");
  const baseUriRef = useRef<string | undefined>(baseUri);
  baseUriRef.current = baseUri;

  const loadContent = useCallback(
    (editor: Editor | null, markdown: string) => {
      if (!editor) return;
      suppressNextUpdate.current = true;
      lastSentText.current = markdown;
      const doc = parseMarkdown(markdown, baseUriRef.current);
      editor.commands.setContent(doc);
    },
    []
  );

  const handleUpdate = useCallback(
    (editor: Editor) => {
      if (suppressNextUpdate.current) {
        suppressNextUpdate.current = false;
        return;
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        const text = serializeMarkdown(editor.getJSON(), baseUriRef.current);
        if (text !== lastSentText.current) {
          lastSentText.current = text;
          postMessage({ type: "webview:contentChanged", text });
        }
      }, DEBOUNCE_MS);
    },
    [postMessage]
  );

  return { loadContent, handleUpdate };
}
