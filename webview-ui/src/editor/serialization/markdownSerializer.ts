// Serialize TipTap JSON document to markdown string

import { unified } from "unified";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { tiptapToMdast } from "./tiptapToMdast";
import type { JSONContent } from "@tiptap/core";

const stringifyOptions = {
  bullet: "-" as const,
  emphasis: "*" as const,
  strong: "*" as const,
  rule: "-" as const,
  listItemIndent: "one" as const,
};

const serializer = unified()
  .use(remarkStringify, stringifyOptions as any)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"]);

export function serializeMarkdown(
  doc: JSONContent,
  baseUri?: string
): string {
  const mdast = tiptapToMdast(doc, baseUri);
  const result = serializer.stringify(mdast as any);
  return typeof result === "string" ? result : String(result);
}
