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
  
  // Handle various URL schemes that should be returned as-is
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return src;
  }
  
  // Try to extract the path portion from vscode-resource or vscode-webview URLs
  // These URLs have the format: vscode-webview://.../.../path/to/file.png
  // or vscode-resource.vscode-cdn.net/encoded/path
  if (src.includes("vscode-resource") || src.includes("vscode-webview")) {
    try {
      const url = new URL(src);
      // Get the decoded pathname
      let pathname = decodeURIComponent(url.pathname);
      
      // Try to match against baseUri to find common path
      if (baseUri) {
        const baseUrl = new URL(baseUri);
        const basePath = decodeURIComponent(baseUrl.pathname);
        
        // If the pathname starts with the base path, remove it
        if (pathname.startsWith(basePath + "/")) {
          return pathname.slice(basePath.length + 1);
        }
        
        // Try to find the relative portion by looking for common segments
        // Example: if pathname is /c:/users/.../workdir/file.md and contains assets/image.png
        const parts = pathname.split("/");
        // Look for "assets" or other folder names that might be relative
        const relativeStart = parts.findIndex((p, i) => 
          i > 0 && !p.includes(":") && p !== "" && parts[i-1] !== ""
        );
        if (relativeStart > 0) {
          // Build relative path from common folders
          const remaining = parts.slice(relativeStart).join("/");
          if (remaining) return remaining;
        }
      }
      
      // Fallback: return the pathname as-is (decoded)
      // Remove leading slash if it looks like an absolute Windows path
      if (pathname.match(/^\/[a-zA-Z]:/)) {
        pathname = pathname.slice(1);
      }
      return pathname;
    } catch (e) {
      // If URL parsing fails, fall through to simple prefix matching
    }
  }
  
  // Simple prefix matching for other cases
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
      // Image is phrasing (inline) content in MDAST and must be wrapped
      // in a paragraph when used at the flow (block) level.  Without this
      // wrapper remark-stringify produces invalid output (all newlines
      // between blocks are dropped).
      if (converted.type === "image") {
        result.push({ type: "paragraph", children: [converted] });
      } else {
        result.push(converted);
      }
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

    case "image": {
      const originalSrc = node.attrs?.originalSrc as string | undefined;
      const src = (node.attrs?.src as string) ?? "";
      return {
        type: "image",
        url: originalSrc ?? unresolveImageUrl(src, baseUri),
        alt: (node.attrs?.alt as string) ?? "",
        title: (node.attrs?.title as string) ?? null,
      };
    }

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
    if (node.type === "image") {
      // Images are inline (phrasing) content in MDAST and must live
      // inside a paragraph.  When the TipTap list item has a
      // preceding empty paragraph (an artefact of the "paragraph block*"
      // schema requirement), merge the image into that paragraph
      // instead of creating a separate one.  This keeps the markdown
      // clean (e.g. `- ![alt](url)` instead of `-\n\n  ![alt](url)`).
      const imgNode = convertNode(node, baseUri);
      if (imgNode) {
        const prev = result[result.length - 1];
        if (
          prev &&
          prev.type === "paragraph" &&
          (!prev.children || prev.children.length === 0)
        ) {
          // Merge image into the preceding empty paragraph
          prev.children = [imgNode];
        } else {
          result.push({ type: "paragraph", children: [imgNode] });
        }
      }
    } else {
      const converted = convertNode(node, baseUri);
      if (converted) {
        result.push(converted);
      }
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
