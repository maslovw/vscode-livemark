import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";

export const ImageNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}) => {
  const { src, alt, title, originalSrc } = node.attrs;

  const handleCaptionKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Save current caption text
      const newAlt = e.currentTarget.textContent || "";
      if (newAlt !== alt) {
        updateAttributes({ alt: newAlt });
      }
      // Insert a new paragraph after the image and focus it
      const pos = getPos();
      if (typeof pos === "number") {
        const endPos = pos + node.nodeSize;
        const { state } = editor.view;
        const { tr } = state;
        const paragraph = state.schema.nodes.paragraph.create();
        tr.insert(endPos, paragraph);
        tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
        editor.view.dispatch(tr);
        editor.view.focus();
      }
    }
  };

  return (
    <NodeViewWrapper
      className={`livemark-image-wrapper${selected ? " selected" : ""}`}
    >
      <figure>
        <img
          src={src}
          alt={alt || ""}
          title={title || undefined}
          className="livemark-image"
        />
        <figcaption
          className="livemark-image-caption"
          contentEditable={true}
          suppressContentEditableWarning={true}
          onKeyDown={handleCaptionKeyDown}
          onBlur={(e) => {
            const newAlt = e.currentTarget.textContent || "";
            if (newAlt !== alt) {
              updateAttributes({ alt: newAlt });
            }
          }}
          data-placeholder="Add caption..."
        >
          {alt || ""}
        </figcaption>
      </figure>
    </NodeViewWrapper>
  );
};
