import React, { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  // Force re-render on editor transactions so active states stay in sync
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => forceUpdate((n) => n + 1);
    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `livemark-toolbar-btn${active ? " active" : ""}`;

  /** Determine the current text style value for the dropdown. */
  const getCurrentTextStyle = (): string => {
    for (let level = 1; level <= 6; level++) {
      if (editor.isActive("heading", { level })) {
        return `h${level}`;
      }
    }
    return "paragraph";
  };

  const handleTextStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.replace("h", ""), 10) as HeadingLevel;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const handleInsertLink = () => {
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    const url = window.prompt("Enter URL:");
    if (!url) return;

    if (hasSelection) {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      const text = window.prompt("Enter link text:", url);
      if (!text) return;
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}">${text}</a>`)
        .run();
    }
  };

  const handleInsertImage = () => {
    const url = window.prompt("Enter image URL:");
    if (!url) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: url,
          originalSrc: url,
        },
      })
      .run();
  };

  const handleInsertTable = () => {
    // insertTable may not be available if the Table extension is not loaded
    const chain = editor.chain().focus();
    if (typeof (chain as any).insertTable === "function") {
      (chain as any)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    }
  };

  const canInsertTable =
    typeof (editor.chain().focus() as any).insertTable === "function";

  return (
    <>
      {/* Text Style Dropdown */}
      <select
        className="livemark-toolbar-select"
        value={getCurrentTextStyle()}
        onChange={handleTextStyleChange}
        title="Text Style"
      >
        <option value="paragraph">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
      </select>

      <span className="livemark-toolbar-separator" />

      {/* Inline Formatting Group */}
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

      {/* List Group */}
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

      {/* Block Insert Group */}
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
      {canInsertTable && (
        <button
          className={btnClass(editor.isActive("table"))}
          onClick={handleInsertTable}
          title="Insert Table"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M0 2v12h16V2H0zm1 1h4v3H1V3zm5 0h4v3H6V3zm5 0h4v3h-4V3zM1 7h4v3H1V7zm5 0h4v3H6V7zm5 0h4v3h-4V7zM1 11h4v2H1v-2zm5 0h4v2H6v-2zm5 0h4v2h-4v-2z" />
          </svg>
        </button>
      )}

      <span className="livemark-toolbar-separator" />

      {/* Link / Image Group */}
      <button
        className={btnClass(editor.isActive("link"))}
        onClick={handleInsertLink}
        title="Insert Link (Cmd+K)"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.8 9.45a.75.75 0 01-1.06-1.06l-1.25 1.25a2 2 0 11-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25z" />
        </svg>
      </button>
      <button
        className={btnClass(false)}
        onClick={handleInsertImage}
        title="Insert Image from URL"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M14.5 2h-13a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h13a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5zM2 3h12v7.09l-2.79-2.79a.5.5 0 00-.71 0L7.5 10.3 5.79 8.59a.5.5 0 00-.71 0L2 11.67V3zm0 10v-.67l3.38-3.38L7.17 10.74a.5.5 0 00.71 0l3-3L14 10.88V13H2z" />
          <circle cx="5" cy="5.5" r="1.5" />
        </svg>
      </button>
    </>
  );
};
