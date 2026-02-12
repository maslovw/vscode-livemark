import React, { useState, useEffect, useRef, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { plantumlServerUrl } from "./plantumlEncode";
import type { PlantUmlBlockOptions } from "./PlantUmlBlock";

export const PlantUmlNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
  extension,
}) => {
  const { plantumlServer } = extension.options as PlantUmlBlockOptions;
  // Source is now stored as a node attribute (atom node, no text content)
  const source = (node.attrs.source as string) || "";
  const viewMode = (node.attrs.viewMode as string) || "rendered";

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastEncodedSource = useRef<string>("");
  const refreshCounter = useRef(0);

  // Build the image URL whenever source changes in rendered mode
  const buildUrl = useCallback(
    async (src: string, force?: boolean) => {
      if (!src.trim()) {
        setImgUrl(null);
        setError(null);
        return;
      }
      // Skip if source hasn't changed and not forced
      if (!force && src === lastEncodedSource.current && imgUrl) return;

      setLoading(true);
      setError(null);
      try {
        const url = await plantumlServerUrl(src, plantumlServer);
        lastEncodedSource.current = src;
        setImgUrl(url);
      } catch (err) {
        setError(`Encoding error: ${err}`);
        setImgUrl(null);
      } finally {
        setLoading(false);
      }
    },
    [plantumlServer, imgUrl]
  );

  // Re-encode when source changes in rendered mode
  useEffect(() => {
    if (viewMode === "rendered") {
      buildUrl(source);
    }
  }, [source, viewMode, buildUrl]);

  // Listen for the custom refresh event via node attr
  const prevRefresh = useRef(node.attrs.refreshCounter ?? 0);
  useEffect(() => {
    const current = node.attrs.refreshCounter ?? 0;
    if (current !== prevRefresh.current) {
      prevRefresh.current = current;
      if (viewMode === "rendered") {
        buildUrl(source, true);
      }
    }
  }, [node.attrs.refreshCounter, viewMode, source, buildUrl]);

  // When switching to rendered mode, re-encode
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (prevViewMode.current !== viewMode && viewMode === "rendered") {
      lastEncodedSource.current = ""; // force re-encode
      buildUrl(source, true);
    }
    prevViewMode.current = viewMode;
  }, [viewMode, source, buildUrl]);

  // Auto-resize textarea
  useEffect(() => {
    if (viewMode === "source" && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }, [viewMode, source]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSource = e.target.value;
    // Update the source attribute directly (atom node — no ProseMirror content)
    updateAttributes({ source: newSource });
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Tab to insert spaces in the source view
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      updateAttributes({ source: newValue });
      // Restore cursor position after React re-render
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }

    // Enter: insert newline normally (don't let ProseMirror intercept)
    if (e.key === "Enter") {
      e.stopPropagation();
    }

    // Escape: move cursor after the block
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos();
      if (typeof pos === "number") {
        const endPos = pos + node.nodeSize;
        const { tr, doc } = editor.view.state;
        // If there is no node after, insert a paragraph
        if (endPos >= doc.content.size) {
          const paragraph = editor.view.state.schema.nodes.paragraph.create();
          tr.insert(endPos, paragraph);
          tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
        } else {
          tr.setSelection(TextSelection.create(doc, endPos));
        }
        editor.view.dispatch(tr);
        editor.view.focus();
      }
    }
  };

  const handleImgError = () => {
    setError("Failed to render diagram. Check your PlantUML syntax or server availability.");
  };

  /** Select this plantumlBlock node so keyboard shortcuts and toolbar buttons work. */
  const selectNode = () => {
    const pos = getPos();
    if (typeof pos === "number") {
      const { tr } = editor.view.state;
      tr.setSelection(NodeSelection.create(editor.view.state.doc, pos));
      editor.view.dispatch(tr);
      editor.view.focus();
    }
  };

  /** Click on the rendered container selects the node. */
  const handleRenderedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    selectNode();
  };

  /** Prevent the browser from dragging the image (which would drop its URL into the editor). */
  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <NodeViewWrapper
      className={`livemark-plantuml-wrapper${selected ? " selected" : ""}`}
      data-view-mode={viewMode}
    >
      <div className="livemark-plantuml-label">PlantUML</div>
      {viewMode === "source" ? (
        <textarea
          ref={textareaRef}
          className="livemark-plantuml-source"
          value={source}
          onChange={handleSourceChange}
          onKeyDown={handleTextareaKeyDown}
          spellCheck={false}
          placeholder="@startuml&#10;...&#10;@enduml"
        />
      ) : (
        <div
          className="livemark-plantuml-rendered"
          onClick={handleRenderedClick}
          onDragStart={handleDragStart}
        >
          {loading && (
            <div className="livemark-plantuml-loading">Rendering…</div>
          )}
          {error && (
            <div className="livemark-plantuml-error">{error}</div>
          )}
          {imgUrl && !error && (
            <img
              src={imgUrl}
              alt="PlantUML Diagram"
              className="livemark-plantuml-img"
              draggable={false}
              onDragStart={handleDragStart}
              onError={handleImgError}
            />
          )}
          {!imgUrl && !loading && !error && (
            <div className="livemark-plantuml-empty">
              Empty diagram — switch to source view to add content
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
};
