import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export const ImageNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const { src, alt, title } = node.attrs;

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
