import React from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export const CodeBlockNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  extension,
}) => {
  const language = (node.attrs.language as string) || "";

  // Get available languages from the lowlight instance
  const lowlight = (extension.options as any).lowlight;
  const languages: string[] = lowlight?.listLanguages?.() ?? [];

  return (
    <NodeViewWrapper className="livemark-code-block-wrapper">
      <pre className="livemark-code-block">
        <NodeViewContent as="code" />
      </pre>
      <div className="livemark-code-block-lang-selector" contentEditable={false}>
        <select
          value={language}
          onChange={(e) =>
            updateAttributes({ language: e.target.value || null })
          }
        >
          <option value="">auto</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
    </NodeViewWrapper>
  );
};
