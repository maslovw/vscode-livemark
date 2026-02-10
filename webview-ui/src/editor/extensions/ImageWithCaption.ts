import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { ImageNodeView } from "./ImageNodeView";

export interface ImageWithCaptionOptions {
  HTMLAttributes: Record<string, unknown>;
  onDeleteImage: (imagePath: string) => void;
  onOpenImage: (imagePath: string) => void;
}

export const ImageWithCaption = Image.extend<ImageWithCaptionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      onDeleteImage: () => {},
      onOpenImage: () => {},
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      originalSrc: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-original-src"),
        renderHTML: (attributes) => {
          if (!attributes.originalSrc) {
            return {};
          }
          return {
            "data-original-src": attributes.originalSrc,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addKeyboardShortcuts() {
    const { onDeleteImage } = this.options;

    const handleDeleteImage = ({ editor }: { editor: any }) => {
      const { state } = editor.view;
      const { selection } = state;

      if (
        selection instanceof NodeSelection &&
        selection.node.type.name === "image"
      ) {
        const imagePath =
          selection.node.attrs.originalSrc || selection.node.attrs.src;
        // Remove the node from the document
        editor.view.dispatch(state.tr.deleteSelection());
        // Ask extension to prompt for disk deletion (only for local files, not URLs)
        if (imagePath && !imagePath.startsWith("http://") && !imagePath.startsWith("https://") && !imagePath.startsWith("data:")) {
          onDeleteImage(imagePath);
        }
        return true;
      }

      return false;
    };

    return {
      Enter: ({ editor }) => {
        const { state } = editor.view;
        const { selection } = state;

        if (
          selection instanceof NodeSelection &&
          selection.node.type.name === "image"
        ) {
          const endPos = selection.to;
          const { tr } = state;
          const paragraph = state.schema.nodes.paragraph.create();
          tr.insert(endPos, paragraph);
          tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
          editor.view.dispatch(tr);
          return true;
        }

        return false;
      },
      Backspace: handleDeleteImage,
      Delete: handleDeleteImage,
    };
  },
});
