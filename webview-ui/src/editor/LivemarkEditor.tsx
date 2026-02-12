import React, { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { createExtensions } from "./extensions";
import type { Editor } from "@tiptap/react";

interface LivemarkEditorProps {
  onUpdate: (editor: Editor) => void;
  onReady: (editor: Editor) => void;
  onImagePaste: (base64: string, fileName: string) => void;
  onLinkClick: (href: string) => void;
  onDeleteImage: (imagePath: string) => void;
  onOpenImage: (imagePath: string) => void;
  editorRef: React.MutableRefObject<Editor | null>;
  plantumlServer?: string;
}

export const LivemarkEditor: React.FC<LivemarkEditorProps> = ({
  onUpdate,
  onReady,
  onImagePaste,
  onLinkClick,
  onDeleteImage,
  onOpenImage,
  editorRef,
  plantumlServer,
}) => {
  const editor = useEditor({
    extensions: createExtensions({ onImagePaste, onLinkClick, onDeleteImage, onOpenImage, plantumlServer }),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    onCreate: ({ editor }) => {
      onReady(editor);
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor);
    },
    editorProps: {
      attributes: {
        class: "livemark-editor-content",
      },
      handleDOMEvents: {
        click: (_view, event) => {
          const target = (event.target as HTMLElement).closest("a");
          if (!target) return false;

          // Open link only on Ctrl+Click (Cmd+Click on Mac)
          if (event.ctrlKey || event.metaKey) {
            const href = target.getAttribute("data-href");
            if (href) {
              event.preventDefault();
              onLinkClick(href);
            }
            return true;
          }

          // Normal click — let ProseMirror place the cursor
          return false;
        },
      },
    },
  });

  // Expose editor reference
  React.useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  // Toggle a CSS class when Ctrl (or Cmd) is held so links show a pointer cursor
  React.useEffect(() => {
    const root = editor?.view?.dom;
    if (!root) return;

    const add = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        root.classList.add("livemark-ctrl-held");
      }
    };
    const remove = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        root.classList.remove("livemark-ctrl-held");
      }
    };
    const clear = () => root.classList.remove("livemark-ctrl-held");

    document.addEventListener("keydown", add);
    document.addEventListener("keyup", remove);
    window.addEventListener("blur", clear);

    return () => {
      document.removeEventListener("keydown", add);
      document.removeEventListener("keyup", remove);
      window.removeEventListener("blur", clear);
    };
  }, [editor]);

  return <EditorContent editor={editor} />;
};
