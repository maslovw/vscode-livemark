import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { ImageWithCaptionOptions } from "./ImageWithCaption";

export const ImageNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
  deleteNode,
  extension,
}) => {
  const { src, alt, title, originalSrc } = node.attrs;
  const { onDeleteImage, onOpenImage } = extension.options as ImageWithCaptionOptions;

  /** Select this image node (NodeSelection) so keyboard shortcuts work. */
  const selectImageNode = () => {
    const pos = getPos();
    if (typeof pos === "number") {
      const { tr } = editor.view.state;
      tr.setSelection(NodeSelection.create(editor.view.state.doc, pos));
      editor.view.dispatch(tr);
      editor.view.focus();
    }
  };

  /** Delete the image node and ask the extension whether to delete from disk. */
  const deleteImageNode = () => {
    const imagePath = originalSrc || src;
    deleteNode();
    // Only ask about disk deletion for local files, not URLs
    if (imagePath && !imagePath.startsWith("http://") && !imagePath.startsWith("https://") && !imagePath.startsWith("data:")) {
      onDeleteImage(imagePath);
    }
  };

  const handleFigureClick = (e: React.MouseEvent<HTMLElement>) => {
    // If the click landed on the figcaption, let it handle focus itself.
    const target = e.target as HTMLElement;
    if (target.closest(".livemark-image-caption")) return;
    e.preventDefault();
    selectImageNode();
  };

  const handleImageDoubleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const imagePath = originalSrc || src;
    if (imagePath) {
      onOpenImage(imagePath);
    }
  };

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

    // Backspace / Delete on an empty caption → delete the image node
    if (e.key === "Backspace" || e.key === "Delete") {
      const captionText = e.currentTarget.textContent || "";
      if (captionText === "") {
        e.preventDefault();
        deleteImageNode();
      }
    }
  };

  return (
    <NodeViewWrapper
      className={`livemark-image-wrapper${selected ? " selected" : ""}`}
    >
      <figure onClick={handleFigureClick}>
        <img
          src={src}
          alt={alt || ""}
          title={title || undefined}
          className="livemark-image"
          onDoubleClick={handleImageDoubleClick}
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
