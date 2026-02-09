// Parse markdown string into TipTap JSON document

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { mdastToTiptap } from "./mdastToTiptap";
import type { JSONContent } from "@tiptap/core";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"]);

export function parseMarkdown(
  markdown: string,
  baseUri?: string
): JSONContent {
  const tree = processor.parse(markdown);
  // Run transforms (remark-gfm needs this for task list detection)
  const transformed = processor.runSync(tree);
  return mdastToTiptap(transformed as any, baseUri);
}
