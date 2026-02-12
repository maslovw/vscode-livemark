// Convert MDAST (remark AST) to TipTap JSON document

import type { JSONContent } from "@tiptap/core";

interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  url?: string;
  alt?: string;
  title?: string;
  lang?: string;
  meta?: string;
  spread?: boolean;
}

/** Resolve a relative image URL against the webview base URI */
export function resolveImageUrl(src: string, baseUri?: string): string {
  if (!baseUri || !src) return src;
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("vscode-webview:")
  ) {
    return src;
  }
  return baseUri.replace(/\/$/, "") + "/" + src;
}

export function mdastToTiptap(
  root: MdastNode,
  baseUri?: string
): JSONContent {
  const content = convertChildren(root.children ?? [], baseUri);
  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

function convertChildren(
  nodes: MdastNode[],
  baseUri?: string
): JSONContent[] {
  const result: JSONContent[] = [];
  for (const node of nodes) {
    const converted = convertNode(node, baseUri);
    if (converted) {
      if (Array.isArray(converted)) {
        result.push(...converted);
      } else {
        result.push(converted);
      }
    }
  }
  return result;
}

function convertNode(
  node: MdastNode,
  baseUri?: string
): JSONContent | JSONContent[] | null {
  switch (node.type) {
    case "heading":
      return {
        type: "heading",
        attrs: { level: node.depth ?? 1 },
        content: convertInlineChildren(node.children ?? [], baseUri),
      };

    case "paragraph": {
      const children = node.children ?? [];
      const hasImages = children.some((c) => c.type === "image");

      if (!hasImages) {
        return {
          type: "paragraph",
          content: convertInlineChildren(children, baseUri),
        };
      }

      // Paragraph contains images - extract them as block nodes
      // since TipTap Image is a block-level node
      const result: JSONContent[] = [];
      let inlineBuffer: MdastNode[] = [];

      const flushInlineBuffer = () => {
        const nonEmpty = inlineBuffer.filter(
          (n) => n.type !== "text" || (n.value && n.value.trim() !== "")
        );
        if (nonEmpty.length > 0) {
          result.push({
            type: "paragraph",
            content: convertInlineChildren(inlineBuffer, baseUri),
          });
        }
        inlineBuffer = [];
      };

      for (const child of children) {
        if (child.type === "image") {
          flushInlineBuffer();
          const originalSrc = child.url ?? "";
          result.push({
            type: "image",
            attrs: {
              src: resolveImageUrl(originalSrc, baseUri),
              originalSrc: originalSrc,
              alt: child.alt ?? null,
              title: child.title ?? null,
            },
          });
        } else {
          inlineBuffer.push(child);
        }
      }
      flushInlineBuffer();

      return result.length === 1 ? result[0] : result;
    }

    case "blockquote":
      return {
        type: "blockquote",
        content: convertChildren(node.children ?? [], baseUri),
      };

    case "code": {
      const lang = node.lang ?? null;
      if (lang === "plantuml") {
        // Determine original format from meta
        const meta = node.meta ?? "";
        const originalFormat = meta.includes("originalFormat:startuml")
          ? "startuml"
          : "fenced";
        return {
          type: "plantumlBlock",
          attrs: {
            language: "plantuml",
            source: node.value || "",
            viewMode: "rendered",
            originalFormat,
          },
        };
      }
      return {
        type: "codeBlock",
        attrs: { language: lang },
        content: node.value ? [{ type: "text", text: node.value }] : [],
      };
    }

    case "list": {
      if (node.ordered) {
        return {
          type: "orderedList",
          content: convertListItems(node.children ?? [], false, baseUri),
        };
      }
      // Check if it's a task list
      const isTaskList = (node.children ?? []).some(
        (child) =>
          child.type === "listItem" &&
          child.checked !== null &&
          child.checked !== undefined
      );
      if (isTaskList) {
        return {
          type: "taskList",
          content: convertListItems(node.children ?? [], true, baseUri),
        };
      }
      return {
        type: "bulletList",
        content: convertListItems(node.children ?? [], false, baseUri),
      };
    }

    case "listItem": {
      return {
        type: "listItem",
        content: convertListItemContent(node.children ?? [], baseUri),
      };
    }

    case "thematicBreak":
      return { type: "horizontalRule" };

    case "image": {
      const originalSrc = node.url ?? "";
      return {
        type: "image",
        attrs: {
          src: resolveImageUrl(originalSrc, baseUri),
          originalSrc: originalSrc,
          alt: node.alt ?? null,
          title: node.title ?? null,
        },
      };
    }

    case "html":
      return {
        type: "paragraph",
        content: node.value ? [{ type: "text", text: node.value }] : [],
      };

    case "yaml":
      return {
        type: "codeBlock",
        attrs: { language: "yaml-frontmatter" },
        content: node.value ? [{ type: "text", text: node.value }] : [],
      };

    case "table": {
      const rows = node.children ?? [];
      const tiptapRows: JSONContent[] = [];
      rows.forEach((row, rowIndex) => {
        const cells = (row.children ?? []).map((cell) => ({
          type: rowIndex === 0 ? "tableHeader" : "tableCell",
          content: [
            {
              type: "paragraph",
              content: convertInlineChildren(cell.children ?? [], baseUri),
            },
          ],
        }));
        tiptapRows.push({ type: "tableRow", content: cells });
      });
      return { type: "table", content: tiptapRows };
    }

    case "break":
      return { type: "hardBreak" };

    default:
      return null;
  }
}

function convertListItems(
  nodes: MdastNode[],
  isTaskList: boolean,
  baseUri?: string
): JSONContent[] {
  return nodes.map((node) => {
    if (isTaskList) {
      return {
        type: "taskItem",
        attrs: { checked: node.checked === true },
        content: convertListItemContent(node.children ?? [], baseUri),
      };
    }
    return {
      type: "listItem",
      content: convertListItemContent(node.children ?? [], baseUri),
    };
  });
}

function convertListItemContent(
  children: MdastNode[],
  baseUri?: string
): JSONContent[] {
  const result: JSONContent[] = [];
  for (const child of children) {
    if (child.type === "paragraph") {
      const converted = convertNode(child, baseUri);
      if (converted) {
        if (Array.isArray(converted)) {
          result.push(...converted);
        } else {
          result.push(converted);
        }
      }
    } else if (child.type === "list") {
      const converted = convertNode(child, baseUri);
      if (converted && !Array.isArray(converted)) {
        result.push(converted);
      }
    } else {
      const converted = convertNode(child, baseUri);
      if (converted) {
        if (Array.isArray(converted)) {
          result.push(...converted);
        } else {
          result.push(converted);
        }
      }
    }
  }

  if (result.length === 0) {
    return [{ type: "paragraph" }];
  }

  // TipTap listItem schema requires content to start with a paragraph
  // ("paragraph block*"). If image extraction from a paragraph left
  // a non-paragraph node first (e.g. a block-level image), prepend
  // an empty paragraph so the schema is satisfied.
  if (result[0].type !== "paragraph") {
    result.unshift({ type: "paragraph" });
  }

  return result;
}

interface InlineResult {
  type: "text";
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

function convertInlineChildren(
  nodes: MdastNode[],
  baseUri?: string
): InlineResult[] {
  const result: InlineResult[] = [];
  for (const node of nodes) {
    const inline = convertInlineNode(node, [], baseUri);
    result.push(...inline);
  }
  return result;
}

function convertInlineNode(
  node: MdastNode,
  marks: Array<{ type: string; attrs?: Record<string, unknown> }>,
  baseUri?: string
): InlineResult[] {
  switch (node.type) {
    case "text":
      return node.value
        ? [
            {
              type: "text",
              text: node.value,
              ...(marks.length > 0 ? { marks: [...marks] } : {}),
            },
          ]
        : [];

    case "strong":
      return flatMapInline(
        node.children ?? [],
        [...marks, { type: "bold" }],
        baseUri
      );

    case "emphasis":
      return flatMapInline(
        node.children ?? [],
        [...marks, { type: "italic" }],
        baseUri
      );

    case "delete":
      return flatMapInline(
        node.children ?? [],
        [...marks, { type: "strike" }],
        baseUri
      );

    case "inlineCode":
      return node.value
        ? [
            {
              type: "text",
              text: node.value,
              marks: [...marks, { type: "code" }],
            },
          ]
        : [];

    case "link":
      return flatMapInline(
        node.children ?? [],
        [
          ...marks,
          {
            type: "link",
            attrs: {
              href: node.url ?? "",
              target: "_blank",
              title: node.title ?? null,
            },
          },
        ],
        baseUri
      );

    case "image":
      // Images in inline context (shouldn't normally happen after paragraph
      // handler extracts them, but handle gracefully as alt text)
      return [
        {
          type: "text",
          text: node.alt || "image",
          ...(marks.length > 0 ? { marks: [...marks] } : {}),
        },
      ];

    case "break":
      return [];

    default:
      return node.value
        ? [
            {
              type: "text",
              text: node.value,
              ...(marks.length > 0 ? { marks: [...marks] } : {}),
            },
          ]
        : [];
  }
}

function flatMapInline(
  nodes: MdastNode[],
  marks: Array<{ type: string; attrs?: Record<string, unknown> }>,
  baseUri?: string
): InlineResult[] {
  const result: InlineResult[] = [];
  for (const node of nodes) {
    result.push(...convertInlineNode(node, marks, baseUri));
  }
  return result;
}
