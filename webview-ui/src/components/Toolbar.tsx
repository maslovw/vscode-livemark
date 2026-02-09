import React from "react";
import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `livemark-toolbar-btn${active ? " active" : ""}`;

  return (
    <>
      <button
        className={btnClass(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd+B)"
      >
        B
      </button>
      <button
        className={btnClass(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd+I)"
      >
        <em>I</em>
      </button>
      <button
        className={btnClass(editor.isActive("strike"))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough (Cmd+Shift+X)"
      >
        <s>S</s>
      </button>
      <button
        className={btnClass(editor.isActive("code"))}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline Code (Cmd+E)"
      >
        {"<>"}
      </button>

      <span className="livemark-toolbar-separator" />

      <button
        className={btnClass(editor.isActive("heading", { level: 1 }))}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        title="Heading 1 (Cmd+1)"
      >
        H1
      </button>
      <button
        className={btnClass(editor.isActive("heading", { level: 2 }))}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        title="Heading 2 (Cmd+2)"
      >
        H2
      </button>
      <button
        className={btnClass(editor.isActive("heading", { level: 3 }))}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        title="Heading 3 (Cmd+3)"
      >
        H3
      </button>

      <span className="livemark-toolbar-separator" />

      <button
        className={btnClass(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        &bull;
      </button>
      <button
        className={btnClass(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        1.
      </button>
      <button
        className={btnClass(editor.isActive("taskList"))}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Task List"
      >
        &#9745;
      </button>

      <span className="livemark-toolbar-separator" />

      <button
        className={btnClass(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        &ldquo;
      </button>
      <button
        className={btnClass(editor.isActive("codeBlock"))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        {"{ }"}
      </button>
      <button
        className={btnClass(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        &mdash;
      </button>
    </>
  );
};
