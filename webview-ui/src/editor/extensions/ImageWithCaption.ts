import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { ImageNodeView } from "./ImageNodeView";
import { getVSCodeApi } from "../../vscodeApi";

export const ImageWithCaption = Image.extend({
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
        // Ask extension to prompt for disk deletion
        if (imagePath) {
          getVSCodeApi().postMessage({
            type: "webview:deleteImage",
            imagePath,
          });
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
