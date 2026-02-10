import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { ImageNodeView } from "./ImageNodeView";

export const ImageWithCaption = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addKeyboardShortcuts() {
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
    };
  },
});
