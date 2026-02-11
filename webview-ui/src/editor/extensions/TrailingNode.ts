/**
 * TrailingNode extension for TipTap.
 *
 * Ensures the document always ends with an empty paragraph so the user can
 * place the cursor after "leaf" blocks such as code-blocks, images,
 * blockquotes, and tables.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const trailingNodePluginKey = new PluginKey("trailingNode");

export const TrailingNode = Extension.create({
  name: "trailingNode",

  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: trailingNodePluginKey,
      appendTransaction(_transactions, _oldState, newState) {
        const { doc, tr, schema } = newState;
        const lastNode = doc.lastChild;

        // Nothing to do when the document already ends with an empty paragraph
        if (
          lastNode &&
          lastNode.type.name === "paragraph" &&
          lastNode.childCount === 0
        ) {
          return null;
        }

        // Append an empty paragraph at the end of the document
        const paragraph = schema.nodes.paragraph.createAndFill();
        if (paragraph) {
          return tr.insert(doc.content.size, paragraph);
        }

        return null;
      },
    });

    return [plugin];
  },
});
