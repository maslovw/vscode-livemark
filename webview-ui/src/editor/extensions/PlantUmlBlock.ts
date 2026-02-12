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

  // Atom node — ProseMirror treats the entire node as a single opaque unit.
  // React has full control of the DOM inside the NodeView.
  // This avoids the removeChild crash caused by ProseMirror and React
  // fighting over DOM ownership when content was "text*".
  atom: true,

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
      /** The PlantUML diagram source text, stored as an attribute. */
      source: {
        default: "",
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
            source: element.textContent || "",
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
      HTMLAttributes.source || "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlantUmlNodeView);
  },

  addCommands() {
    return {
      insertPlantUmlBlock:
        (source?: string) =>
        ({ commands }) => {
          const content = source || "@startuml\n\n@enduml";
          return commands.insertContent({
            type: this.name,
            attrs: {
              language: "plantuml",
              source: content,
              viewMode: "source",
              originalFormat: "fenced",
            },
          });
        },

      togglePlantUmlViewMode:
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
      Backspace: ({ editor }) => {
        const { state } = editor.view;
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
        const src = (nodeRef.attrs.source as string) || "";
        if (src === "") {
          const pos = nodePos as number;
          const tr = state.tr.delete(pos, pos + nodeRef.nodeSize);
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
