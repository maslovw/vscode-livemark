import React, { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { createExtensions } from "./extensions";
import type { Editor } from "@tiptap/react";

interface LivemarkEditorProps {
  onUpdate: (editor: Editor) => void;
  onReady: (editor: Editor) => void;
  onImagePaste: (base64: string, fileName: string) => void;
  onLinkClick: (href: string) => void;
  editorRef: React.MutableRefObject<Editor | null>;
}

export const LivemarkEditor: React.FC<LivemarkEditorProps> = ({
  onUpdate,
  onReady,
  onImagePaste,
  onLinkClick,
  editorRef,
}) => {
  const editor = useEditor({
    extensions: createExtensions({ onImagePaste, onLinkClick }),
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

  return <EditorContent editor={editor} />;
};
