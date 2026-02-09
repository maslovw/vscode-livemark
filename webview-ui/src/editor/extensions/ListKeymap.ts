import { Extension } from "@tiptap/core";

/**
 * Adds Tab / Shift+Tab keyboard shortcuts to indent/outdent list items.
 *
 * - Tab → sinkListItem (indent) for both listItem and taskItem
 * - Shift+Tab → liftListItem (outdent) for both listItem and taskItem
 *
 * The commands only fire when the cursor is inside a list item,
 * so normal Tab behavior is preserved outside lists.
 */
export const ListKeymap = Extension.create({
  name: "listKeymap",

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.commands.sinkListItem("listItem")) {
          return true;
        }
        if (this.editor.commands.sinkListItem("taskItem")) {
          return true;
        }
        return false;
      },
      "Shift-Tab": () => {
        if (this.editor.commands.liftListItem("listItem")) {
          return true;
        }
        if (this.editor.commands.liftListItem("taskItem")) {
          return true;
        }
        return false;
      },
    };
  },
});
