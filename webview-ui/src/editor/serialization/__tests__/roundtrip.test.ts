import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../markdownParser";
import { serializeMarkdown } from "../markdownSerializer";
import { mdastToTiptap } from "../mdastToTiptap";
import { tiptapToMdast } from "../tiptapToMdast";

/**
 * Roundtrip: parse markdown -> serialize back -> compare.
 *
 * Because the serializer normalises whitespace and marker style (e.g. bullet
 * always becomes `-`), we compare the *re-serialised* form rather than the
 * original source. The invariant we check is:
 *
 *   serialize(parse(md)) === serialize(parse(serialize(parse(md))))
 *
 * i.e. after one roundtrip the output is stable.
 */
function roundtrip(md: string): string {
  const tiptapDoc = parseMarkdown(md);
  return serializeMarkdown(tiptapDoc);
}

function assertStableRoundtrip(md: string) {
  const first = roundtrip(md);
  const second = roundtrip(first);
  expect(second).toBe(first);
}

describe("roundtrip: parse -> serialize -> parse -> serialize stability", () => {
  it("H1 heading", () => {
    assertStableRoundtrip("# Hello World");
  });

  it("H3 heading", () => {
    assertStableRoundtrip("### Sub-sub heading");
  });

  it("simple paragraph", () => {
    assertStableRoundtrip("Just a simple paragraph.");
  });

  it("multiple paragraphs", () => {
    assertStableRoundtrip("Paragraph one.\n\nParagraph two.");
  });

  it("bold text", () => {
    assertStableRoundtrip("**bold**");
  });

  it("italic text", () => {
    assertStableRoundtrip("*italic*");
  });

  it("strikethrough text", () => {
    assertStableRoundtrip("~~deleted~~");
  });

  it("inline code", () => {
    assertStableRoundtrip("`code`");
  });

  it("link", () => {
    assertStableRoundtrip("[click](https://example.com)");
  });

  it("link with title", () => {
    assertStableRoundtrip('[click](https://example.com "Title")');
  });

  it("fenced code block with language", () => {
    assertStableRoundtrip("```javascript\nconsole.log('hi');\n```");
  });

  it("fenced code block without language", () => {
    assertStableRoundtrip("```\nplain\n```");
  });

  it("blockquote", () => {
    assertStableRoundtrip("> A quoted line");
  });

  it("unordered list", () => {
    assertStableRoundtrip("- Alpha\n- Beta\n- Gamma");
  });

  it("ordered list", () => {
    assertStableRoundtrip("1. First\n2. Second\n3. Third");
  });

  it("task list", () => {
    assertStableRoundtrip("- [ ] Todo\n- [x] Done");
  });

  it("horizontal rule", () => {
    assertStableRoundtrip("---");
  });

  it("YAML frontmatter followed by content", () => {
    assertStableRoundtrip("---\ntitle: Test\n---\n\nContent");
  });

  it("blockquote containing a list", () => {
    assertStableRoundtrip("> - A\n> - B");
  });

  it("mixed inline formatting", () => {
    assertStableRoundtrip("Normal **bold** and *italic* text");
  });

  it("bold+italic combined", () => {
    assertStableRoundtrip("***bolditalic***");
  });
});

// ---------------------------------------------------------------------------
// mdastToTiptap unit tests (direct MDAST -> TipTap conversion)
// ---------------------------------------------------------------------------
describe("mdastToTiptap", () => {
  it("converts an empty root", () => {
    const result = mdastToTiptap({ type: "root", children: [] });
    expect(result.type).toBe("doc");
    // Empty root should produce at least one empty paragraph
    expect(result.content).toEqual([{ type: "paragraph" }]);
  });

  it("converts a heading node", () => {
    const mdast = {
      type: "root",
      children: [
        {
          type: "heading",
          depth: 2,
          children: [{ type: "text", value: "Hello" }],
        },
      ],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Hello" }],
    });
  });

  it("converts a thematicBreak to horizontalRule", () => {
    const mdast = {
      type: "root",
      children: [{ type: "thematicBreak" }],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0]).toEqual({ type: "horizontalRule" });
  });

  it("converts a code node to codeBlock", () => {
    const mdast = {
      type: "root",
      children: [{ type: "code", lang: "python", value: "print('hi')" }],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "python" },
      content: [{ type: "text", text: "print('hi')" }],
    });
  });

  it("converts yaml node to codeBlock with yaml-frontmatter language", () => {
    const mdast = {
      type: "root",
      children: [{ type: "yaml", value: "title: Test" }],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "yaml-frontmatter" },
      content: [{ type: "text", text: "title: Test" }],
    });
  });

  it("converts a blockquote with nested paragraph", () => {
    const mdast = {
      type: "root",
      children: [
        {
          type: "blockquote",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: "Quote" }],
            },
          ],
        },
      ],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0].type).toBe("blockquote");
    expect(result.content![0].content![0].type).toBe("paragraph");
  });

  it("converts an unordered list", () => {
    const mdast = {
      type: "root",
      children: [
        {
          type: "list",
          ordered: false,
          children: [
            {
              type: "listItem",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "Item" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0].type).toBe("bulletList");
    expect(result.content![0].content![0].type).toBe("listItem");
  });

  it("converts a task list with checked items", () => {
    const mdast = {
      type: "root",
      children: [
        {
          type: "list",
          ordered: false,
          children: [
            {
              type: "listItem",
              checked: false,
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "Unchecked" }],
                },
              ],
            },
            {
              type: "listItem",
              checked: true,
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "Checked" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0].type).toBe("taskList");
    expect(result.content![0].content![0]).toMatchObject({
      type: "taskItem",
      attrs: { checked: false },
    });
    expect(result.content![0].content![1]).toMatchObject({
      type: "taskItem",
      attrs: { checked: true },
    });
  });

  it("converts inline emphasis to italic mark", () => {
    const mdast = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "emphasis",
              children: [{ type: "text", value: "em" }],
            },
          ],
        },
      ],
    };
    const result = mdastToTiptap(mdast as any);
    const inline = result.content![0].content![0];
    expect(inline.text).toBe("em");
    expect(inline.marks).toContainEqual({ type: "italic" });
  });

  it("converts an image node", () => {
    const mdast = {
      type: "root",
      children: [
        {
          type: "image",
          url: "https://example.com/image.png",
          alt: "An image",
          title: "Title",
        },
      ],
    };
    const result = mdastToTiptap(mdast as any);
    expect(result.content![0]).toMatchObject({
      type: "image",
      attrs: {
        src: "https://example.com/image.png",
        alt: "An image",
        title: "Title",
      },
    });
  });

  it("ignores unknown node types gracefully", () => {
    const mdast = {
      type: "root",
      children: [{ type: "unknown_node_xyz" }],
    };
    const result = mdastToTiptap(mdast as any);
    // Unknown nodes are skipped; empty root should give empty paragraph
    expect(result.content).toEqual([{ type: "paragraph" }]);
  });
});

// ---------------------------------------------------------------------------
// tiptapToMdast unit tests (direct TipTap -> MDAST conversion)
// ---------------------------------------------------------------------------
describe("tiptapToMdast", () => {
  it("converts an empty doc", () => {
    const result = tiptapToMdast({ type: "doc", content: [] });
    expect(result.type).toBe("root");
    expect(result.children).toEqual([]);
  });

  it("converts a heading to mdast heading", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Test" }],
        },
      ],
    });
    expect(result.children![0]).toMatchObject({
      type: "heading",
      depth: 3,
    });
  });

  it("converts a paragraph to mdast paragraph", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    });
    expect(result.children![0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "Hello" }],
    });
  });

  it("converts horizontalRule to thematicBreak", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [{ type: "horizontalRule" }],
    });
    expect(result.children![0]).toEqual({ type: "thematicBreak" });
  });

  it("converts codeBlock to mdast code", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "rust" },
          content: [{ type: "text", text: "fn main() {}" }],
        },
      ],
    });
    expect(result.children![0]).toMatchObject({
      type: "code",
      lang: "rust",
      value: "fn main() {}",
    });
  });

  it("converts yaml-frontmatter codeBlock to yaml node", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "yaml-frontmatter" },
          content: [{ type: "text", text: "title: Hello" }],
        },
      ],
    });
    expect(result.children![0]).toMatchObject({
      type: "yaml",
      value: "title: Hello",
    });
  });

  it("converts bulletList to unordered mdast list", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "A" }] },
              ],
            },
          ],
        },
      ],
    });
    expect(result.children![0]).toMatchObject({
      type: "list",
      ordered: false,
    });
  });

  it("converts orderedList to ordered mdast list", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "A" }] },
              ],
            },
          ],
        },
      ],
    });
    expect(result.children![0]).toMatchObject({
      type: "list",
      ordered: true,
    });
  });

  it("converts taskList to list with checked items", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Done" }],
                },
              ],
            },
          ],
        },
      ],
    });
    const listItem = result.children![0].children![0];
    expect(listItem.checked).toBe(true);
  });

  it("converts bold mark to strong wrapper", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
          ],
        },
      ],
    });
    const inline = result.children![0].children![0];
    expect(inline.type).toBe("strong");
    expect(inline.children![0]).toMatchObject({
      type: "text",
      value: "bold",
    });
  });

  it("converts italic mark to emphasis wrapper", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "em", marks: [{ type: "italic" }] },
          ],
        },
      ],
    });
    const inline = result.children![0].children![0];
    expect(inline.type).toBe("emphasis");
  });

  it("converts code mark to inlineCode", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "code" }] },
          ],
        },
      ],
    });
    const inline = result.children![0].children![0];
    expect(inline.type).toBe("inlineCode");
    expect(inline.value).toBe("x");
  });

  it("converts link mark to mdast link", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.com" },
                },
              ],
            },
          ],
        },
      ],
    });
    const inline = result.children![0].children![0];
    expect(inline.type).toBe("link");
    expect(inline.url).toBe("https://example.com");
    expect(inline.children![0]).toMatchObject({
      type: "text",
      value: "click",
    });
  });

  it("converts strike mark to delete wrapper", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "del", marks: [{ type: "strike" }] },
          ],
        },
      ],
    });
    const inline = result.children![0].children![0];
    expect(inline.type).toBe("delete");
  });

  it("converts hardBreak to break node", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "before" },
            { type: "hardBreak" },
            { type: "text", text: "after" },
          ],
        },
      ],
    });
    const children = result.children![0].children!;
    const breakNode = children.find((c: any) => c.type === "break");
    expect(breakNode).toBeDefined();
  });

  it("converts blockquote to mdast blockquote", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted" }],
            },
          ],
        },
      ],
    });
    expect(result.children![0].type).toBe("blockquote");
    expect(result.children![0].children![0].type).toBe("paragraph");
  });

  it("ignores unknown node types", () => {
    const result = tiptapToMdast({
      type: "doc",
      content: [{ type: "someUnknownNode" }],
    });
    expect(result.children).toEqual([]);
  });
});
