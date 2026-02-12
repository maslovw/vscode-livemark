import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PlantUmlNodeView } from "./PlantUmlNodeView";
import { TextSelection } from "@tiptap/pm/state";

export interface PlantUmlBlockOptions {
  HTMLAttributes: Record<string, unknown>;
  plantumlServer: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    plantumlBlock: {
      /**
       * Insert a PlantUML block with optional initial source.
       */
      insertPlantUmlBlock: (source?: string) => ReturnType;
      /**
       * Toggle the view mode of the active PlantUML block between
       * "rendered" and "source".
       */
      togglePlantUmlViewMode: () => ReturnType;
      /**
       * Force-refresh the rendered diagram.
       */
      refreshPlantUml: () => ReturnType;
    };
  }
}

export const PlantUmlBlock = Node.create<PlantUmlBlockOptions>({
  name: "plantumlBlock",

  group: "block",

  content: "text*",

  marks: "",

  code: true,

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      plantumlServer: "https://www.plantuml.com/plantuml",
    };
  },

  addAttributes() {
    return {
      language: {
        default: "plantuml",
      },
      viewMode: {
        default: "rendered",
      },
      originalFormat: {
        default: "fenced",
        // "fenced" = ```plantuml ... ```
        // "startuml" = @startuml ... @enduml
      },
      refreshCounter: {
        default: 0,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre[data-plantuml]",
        getAttrs: (el) => {
          const element = el as HTMLElement;
          return {
            viewMode: element.getAttribute("data-view-mode") || "rendered",
            originalFormat: element.getAttribute("data-original-format") || "fenced",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-plantuml": "",
        "data-view-mode": HTMLAttributes.viewMode || "rendered",
        "data-original-format": HTMLAttributes.originalFormat || "fenced",
      }),
      ["code", {}, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlantUmlNodeView);
  },

  addCommands() {
    return {
      insertPlantUmlBlock:
        (source?: string) =>
        ({ commands, state }) => {
          const content = source || "@startuml\n\n@enduml";
          return commands.insertContent({
            type: this.name,
            attrs: {
              language: "plantuml",
              viewMode: "source",
              originalFormat: "fenced",
            },
            content: [{ type: "text", text: content }],
          });
        },

      togglePlantUmlViewMode:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          // Find the plantumlBlock node around the selection
          let nodePos: number | null = null;
          let nodeRef: any = null;
          state.doc.nodesBetween(
            selection.from,
            selection.to,
            (node, pos) => {
              if (node.type.name === "plantumlBlock" && nodePos === null) {
                nodePos = pos;
                nodeRef = node;
              }
            }
          );
          if (nodePos === null || !nodeRef) return false;
          if (dispatch) {
            const currentMode = nodeRef.attrs.viewMode || "rendered";
            const newMode =
              currentMode === "rendered" ? "source" : "rendered";
            const tr = state.tr.setNodeMarkup(nodePos, undefined, {
              ...nodeRef.attrs,
              viewMode: newMode,
            });
            dispatch(tr);
          }
          return true;
        },

      refreshPlantUml:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          let nodePos: number | null = null;
          let nodeRef: any = null;
          state.doc.nodesBetween(
            selection.from,
            selection.to,
            (node, pos) => {
              if (node.type.name === "plantumlBlock" && nodePos === null) {
                nodePos = pos;
                nodeRef = node;
              }
            }
          );
          if (nodePos === null || !nodeRef) return false;
          if (dispatch) {
            const tr = state.tr.setNodeMarkup(nodePos, undefined, {
              ...nodeRef.attrs,
              viewMode: "rendered",
              refreshCounter: (nodeRef.attrs.refreshCounter ?? 0) + 1,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter: allow newlines inside the block (handled by textarea in NodeView)
      // Backspace on empty block: delete the block
      Backspace: ({ editor }) => {
        const { state } = editor.view;
        const { selection } = state;
        // Only handle when the block is empty
        let nodePos: number | null = null;
        let nodeRef: any = null;
        state.doc.nodesBetween(
          selection.from,
          selection.to,
          (node, pos) => {
            if (node.type.name === "plantumlBlock" && nodePos === null) {
              nodePos = pos;
              nodeRef = node;
            }
          }
        );
        if (nodePos === null || !nodeRef) return false;
        if (nodeRef.textContent === "") {
          const pos = nodePos as number;
          const tr = state.tr.delete(pos, pos + nodeRef.nodeSize);
          // Place cursor at the deletion point
          const mappedPos = tr.mapping.map(pos);
          if (mappedPos <= tr.doc.content.size) {
            tr.setSelection(TextSelection.create(tr.doc, Math.min(mappedPos, tr.doc.content.size)));
          }
          editor.view.dispatch(tr);
          return true;
        }
        return false;
      },
    };
  },
});
