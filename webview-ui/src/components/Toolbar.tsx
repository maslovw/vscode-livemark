import React, { useState, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { InlineDialog } from "./InlineDialog";
import type { InlineDialogField } from "./InlineDialog";
import { ToolbarMenu } from "./ToolbarMenu";

interface ToolbarProps {
  editor: Editor | null;
  toolbarContextMode: string;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type DialogKind = "link" | "editLink" | "image" | null;

/** Build a snapshot string of all formatting states we display in the toolbar. */
function getActiveStateKey(editor: Editor): string {
  const parts: string[] = [];
  for (let level = 1; level <= 6; level++) {
    if (editor.isActive("heading", { level })) {
      parts.push(`h${level}`);
      break;
    }
  }
  for (const mark of [
    "bold", "italic", "strike", "code",
    "bulletList", "orderedList", "taskList",
    "blockquote", "codeBlock", "table", "link",
    "plantumlBlock",
  ] as const) {
    if (editor.isActive(mark)) parts.push(mark);
  }
  // Context flags for re-render on selection type changes
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === "image") {
    parts.push("ctx:image");
  }
  return parts.join(",");
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor, toolbarContextMode }) => {
  // Only re-render when the set of *active* formatting marks actually changes,
  // so that opening a <select> dropdown isn't disrupted by unrelated transactions.
  const [, setStateKey] = useState("");
  const prevKeyRef = useRef("");

  /* ---- dialog state (must be before any conditional returns) ---- */
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogFields, setDialogFields] = useState<InlineDialogField[]>([]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const key = getActiveStateKey(editor);
      if (key !== prevKeyRef.current) {
        prevKeyRef.current = key;
        setStateKey(key);
      }
    };
    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor]);

  if (!editor) return null;

  // Context detection
  const { selection } = editor.state;
  const isImageSelected = selection instanceof NodeSelection && selection.node.type.name === "image";
  const isInTable = editor.isActive("table");
  const isInCodeBlock = editor.isActive("codeBlock");
  const isInPlantUml = editor.isActive("plantumlBlock");
  const textFormattingDisabled = isImageSelected || isInCodeBlock || isInPlantUml;

  const hideMode = toolbarContextMode === "hide";

  const btnClass = (active: boolean, disabled?: boolean) =>
    `livemark-toolbar-btn${active ? " active" : ""}${disabled ? " disabled" : ""}`;

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

  const closeDialog = () => setDialog(null);

  const handleInsertLink = () => {
    const { from, to } = editor.state.selection;
    const selectedText =
      from !== to ? editor.state.doc.textBetween(from, to) : "";

    // If cursor is already inside a link, open edit dialog pre-filled
    if (editor.isActive("link")) {
      const attrs = editor.getAttributes("link");
      setDialogFields([
        { key: "url", label: "URL", defaultValue: attrs.href ?? "" },
        { key: "text", label: "Text", defaultValue: selectedText },
      ]);
      setDialog("editLink");
      return;
    }

    setDialogFields([
      { key: "url", label: "URL", defaultValue: "" },
      ...(selectedText
        ? []
        : [{ key: "text", label: "Text", defaultValue: "" }]),
    ]);
    setDialog("link");
  };

  const handleLinkSubmit = (values: Record<string, string>) => {
    const url = values.url?.trim();
    if (!url) {
      closeDialog();
      return;
    }
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (dialog === "editLink") {
      // Update existing link
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else if (hasSelection) {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      const text = values.text?.trim() || url;
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}">${text}</a>`)
        .run();
    }
    closeDialog();
  };

  const handleInsertImage = () => {
    setDialogFields([{ key: "url", label: "Image URL", defaultValue: "" }]);
    setDialog("image");
  };

  const handleImageSubmit = (values: Record<string, string>) => {
    const url = values.url?.trim();
    if (!url) {
      closeDialog();
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { src: url, originalSrc: url },
      })
      .run();
    closeDialog();
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
    typeof (editor.commands as any).insertTable === "function";

  const tableSvg = (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M0 2v12h16V2H0zm1 1h4v3H1V3zm5 0h4v3H6V3zm5 0h4v3h-4V3zM1 7h4v3H1V7zm5 0h4v3H6V7zm5 0h4v3h-4V7zM1 11h4v2H1v-2zm5 0h4v2H6v-2zm5 0h4v2h-4v-2z" />
    </svg>
  );

  // Text formatting section (select + bold/italic/strike/code)
  const renderTextFormatting = () => {
    if (hideMode && textFormattingDisabled) return null;

    return (
      <>
        {/* Text Style Dropdown */}
        <select
          className="livemark-toolbar-select"
          value={getCurrentTextStyle()}
          onChange={handleTextStyleChange}
          title="Text Style"
          disabled={textFormattingDisabled}
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
          className={btnClass(editor.isActive("bold"), textFormattingDisabled)}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Cmd+B)"
          aria-disabled={textFormattingDisabled}
        >
          B
        </button>
        <button
          className={btnClass(editor.isActive("italic"), textFormattingDisabled)}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Cmd+I)"
          aria-disabled={textFormattingDisabled}
        >
          <em>I</em>
        </button>
        <button
          className={btnClass(editor.isActive("strike"), textFormattingDisabled)}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough (Cmd+Shift+X)"
          aria-disabled={textFormattingDisabled}
        >
          <s>S</s>
        </button>
        <button
          className={btnClass(editor.isActive("code"), textFormattingDisabled)}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline Code (Cmd+E)"
          aria-disabled={textFormattingDisabled}
        >
          {"<>"}
        </button>

        <span className="livemark-toolbar-separator" />
      </>
    );
  };

  return (
    <div className="livemark-toolbar-group" style={{ display: "contents" }}>
      {renderTextFormatting()}

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
        className={btnClass(editor.isActive("plantumlBlock"))}
        onClick={() => (editor.chain().focus() as any).insertPlantUmlBlock().run()}
        title="Insert PlantUML Diagram"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M4 1C2.34 1 1 2.34 1 4v8c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3H4zm0 1h8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm1.5 2C4.67 4 4 4.67 4 5.5S4.67 7 5.5 7 7 6.33 7 5.5 6.33 4 5.5 4zm5 2C9.67 6 9 6.67 9 7.5S9.67 9 10.5 9 12 8.33 12 7.5 11.33 6 10.5 6zM5 9c-.55 0-1.04.23-1.41.59l-.09.1V12c0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2v-.5c0-.83-.67-1.5-1.5-1.5-.42 0-.79.17-1.06.44l-.44.44-.44-.44C9.79 10.17 9.42 10 9 10s-.79.17-1.06.44l-.44.44-.44-.44C6.79 9.17 6.42 9 6 9h-1z" />
        </svg>
      </button>
      {isInPlantUml && (
        <>
          <button
            className={btnClass(false)}
            onClick={() => (editor.chain().focus() as any).togglePlantUmlViewMode().run()}
            title="Toggle Source/Rendered View"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 3C4.36 3 1.26 5.28.05 8.5c1.21 3.22 4.31 5.5 7.95 5.5s6.74-2.28 7.95-5.5C14.74 5.28 11.64 3 8 3zm0 9.17c-2.01 0-3.64-1.49-3.64-3.33S5.99 5.5 8 5.5s3.64 1.5 3.64 3.34S10.01 12.17 8 12.17zM8 7c-1.1 0-2 .82-2 1.83S6.9 10.67 8 10.67s2-.82 2-1.84S9.1 7 8 7z" />
            </svg>
          </button>
          <button
            className={btnClass(false)}
            onClick={() => (editor.chain().focus() as any).refreshPlantUml().run()}
            title="Refresh Diagram"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M13.45 2.55A7.96 7.96 0 008 .5C4.14.5 1.01 3.63 1.01 7.5H0l3.5 3.5L7 7.5H4.51c0-1.93 1.56-3.5 3.49-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-.97 0-1.84-.39-2.48-1.02l-1.41 1.41A5.48 5.48 0 008 13.5c3.04 0 5.5-2.46 5.5-5.5 0-1.52-.62-2.9-1.61-3.89l-.44-.56z" />
            </svg>
          </button>
        </>
      )}
      <button
        className={btnClass(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        &mdash;
      </button>
      {canInsertTable && !isInTable && (
        <button
          className={btnClass(false)}
          onClick={handleInsertTable}
          title="Insert Table"
        >
          {tableSvg}
        </button>
      )}
      {canInsertTable && isInTable && (
        <ToolbarMenu
          trigger={tableSvg}
          title="Table"
          items={[
            { label: "Add Row Below", action: () => (editor.chain().focus() as any).addRowAfter().run() },
            { label: "Add Column Right", action: () => (editor.chain().focus() as any).addColumnAfter().run() },
            { label: "Delete Row", action: () => (editor.chain().focus() as any).deleteRow().run() },
            { label: "Delete Column", action: () => (editor.chain().focus() as any).deleteColumn().run() },
            { label: "Delete Table", action: () => (editor.chain().focus() as any).deleteTable().run(), danger: true },
          ]}
        />
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

      {/* Inline dialogs */}
      {(dialog === "link" || dialog === "editLink") && (
        <InlineDialog
          title={dialog === "editLink" ? "Edit Link" : "Insert Link"}
          fields={dialogFields}
          submitLabel={dialog === "editLink" ? "Update" : "Insert"}
          onSubmit={handleLinkSubmit}
          onCancel={closeDialog}
        />
      )}
      {dialog === "image" && (
        <InlineDialog
          title="Insert Image"
          fields={dialogFields}
          submitLabel="Insert"
          onSubmit={handleImageSubmit}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
};
