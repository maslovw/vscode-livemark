// Convert TipTap JSON document to MDAST (remark AST)

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
  lang?: string | null;
  meta?: string | null;
  spread?: boolean;
}

/** Strip the webview base URI prefix from an image URL to get the relative path */
function unresolveImageUrl(src: string, baseUri?: string): string {
  if (!baseUri || !src) return src;
  const prefix = baseUri.replace(/\/$/, "") + "/";
  if (src.startsWith(prefix)) {
    return src.slice(prefix.length);
  }
  return src;
}

export function tiptapToMdast(
  doc: JSONContent,
  baseUri?: string
): MdastNode {
  return {
    type: "root",
    children: convertNodes(doc.content ?? [], baseUri),
  };
}

function convertNodes(
  nodes: JSONContent[],
  baseUri?: string
): MdastNode[] {
  const result: MdastNode[] = [];
  for (const node of nodes) {
    const converted = convertNode(node, baseUri);
    if (converted) {
      result.push(converted);
    }
  }
  return result;
}

function convertNode(
  node: JSONContent,
  baseUri?: string
): MdastNode | null {
  switch (node.type) {
    case "heading":
      return {
        type: "heading",
        depth: (node.attrs?.level as number) ?? 1,
        children: convertInlineContent(node.content ?? [], baseUri),
      };

    case "paragraph":
      return {
        type: "paragraph",
        children: convertInlineContent(node.content ?? [], baseUri),
      };

    case "blockquote":
      return {
        type: "blockquote",
        children: convertNodes(node.content ?? [], baseUri),
      };

    case "codeBlock": {
      const lang = node.attrs?.language as string | null;
      if (lang === "yaml-frontmatter") {
        return {
          type: "yaml",
          value: getTextContent(node),
        };
      }
      return {
        type: "code",
        lang: lang || null,
        meta: null,
        value: getTextContent(node),
      };
    }

    case "bulletList":
      return {
        type: "list",
        ordered: false,
        spread: false,
        children: convertListItems(node.content ?? [], baseUri),
      };

    case "orderedList":
      return {
        type: "list",
        ordered: true,
        spread: false,
        children: convertListItems(node.content ?? [], baseUri),
      };

    case "taskList":
      return {
        type: "list",
        ordered: false,
        spread: false,
        children: convertTaskItems(node.content ?? [], baseUri),
      };

    case "listItem":
      return {
        type: "listItem",
        spread: false,
        children: convertListItemContent(node.content ?? [], baseUri),
      };

    case "taskItem":
      return {
        type: "listItem",
        spread: false,
        checked: (node.attrs?.checked as boolean) ?? false,
        children: convertListItemContent(node.content ?? [], baseUri),
      };

    case "horizontalRule":
      return { type: "thematicBreak" };

    case "hardBreak":
      return { type: "break" };

    case "image":
      return {
        type: "image",
        url: unresolveImageUrl((node.attrs?.src as string) ?? "", baseUri),
        alt: (node.attrs?.alt as string) ?? undefined,
        title: (node.attrs?.title as string) ?? undefined,
      };

    case "table": {
      const rows = (node.content ?? []).map((row) => ({
        type: "tableRow" as const,
        children: (row.content ?? []).map((cell) => ({
          type: "tableCell" as const,
          children: convertInlineContent(
            cell.content?.[0]?.content ?? [],
            baseUri
          ),
        })),
      }));
      return {
        type: "table",
        children: rows,
      };
    }

    default:
      return null;
  }
}

function convertListItems(
  items: JSONContent[],
  baseUri?: string
): MdastNode[] {
  return items.map((item) => ({
    type: "listItem" as const,
    spread: false,
    children: convertListItemContent(item.content ?? [], baseUri),
  }));
}

function convertTaskItems(
  items: JSONContent[],
  baseUri?: string
): MdastNode[] {
  return items.map((item) => ({
    type: "listItem" as const,
    spread: false,
    checked: (item.attrs?.checked as boolean) ?? false,
    children: convertListItemContent(item.content ?? [], baseUri),
  }));
}

function convertListItemContent(
  nodes: JSONContent[],
  baseUri?: string
): MdastNode[] {
  const result: MdastNode[] = [];
  for (const node of nodes) {
    const converted = convertNode(node, baseUri);
    if (converted) {
      result.push(converted);
    }
  }
  return result.length > 0
    ? result
    : [{ type: "paragraph", children: [] }];
}

function convertInlineContent(
  nodes: JSONContent[],
  baseUri?: string
): MdastNode[] {
  const result: MdastNode[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      const marks = (node.marks ?? []) as Array<{
        type: string;
        attrs?: Record<string, unknown>;
      }>;
      let textNode: MdastNode = { type: "text", value: node.text ?? "" };

      // Wrap text in mark nodes
      for (const mark of marks) {
        textNode = wrapInMark(textNode, mark);
      }
      result.push(textNode);
    } else if (node.type === "hardBreak") {
      result.push({ type: "break" });
    } else if (node.type === "image") {
      result.push({
        type: "image",
        url: unresolveImageUrl(
          (node.attrs?.src as string) ?? "",
          baseUri
        ),
        alt: (node.attrs?.alt as string) ?? undefined,
        title: (node.attrs?.title as string) ?? undefined,
      });
    }
  }

  return result;
}

function wrapInMark(
  node: MdastNode,
  mark: { type: string; attrs?: Record<string, unknown> }
): MdastNode {
  switch (mark.type) {
    case "bold":
      return { type: "strong", children: [node] };
    case "italic":
      return { type: "emphasis", children: [node] };
    case "strike":
      return { type: "delete", children: [node] };
    case "code":
      return { type: "inlineCode", value: node.value ?? "" };
    case "link":
      return {
        type: "link",
        url: (mark.attrs?.href as string) ?? "",
        title: (mark.attrs?.title as string) ?? undefined,
        children: [node],
      };
    default:
      return node;
  }
}

function getTextContent(node: JSONContent): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map((child) => child.text ?? "").join("");
}
