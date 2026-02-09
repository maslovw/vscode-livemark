import { describe, it, expect } from "vitest";
import { serializeMarkdown } from "../markdownSerializer";
import type { JSONContent } from "@tiptap/core";

// Helpers to construct TipTap JSON nodes
function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

function paragraph(...content: JSONContent[]): JSONContent {
  return { type: "paragraph", content };
}

function text(t: string, marks?: any[]): JSONContent {
  return marks ? { type: "text", text: t, marks } : { type: "text", text: t };
}

function heading(level: number, ...content: JSONContent[]): JSONContent {
  return { type: "heading", attrs: { level }, content };
}

function codeBlock(code: string, language?: string | null): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language: language ?? null },
    content: code ? [{ type: "text", text: code }] : [],
  };
}

function blockquote(...content: JSONContent[]): JSONContent {
  return { type: "blockquote", content };
}

function bulletList(...items: JSONContent[]): JSONContent {
  return { type: "bulletList", content: items };
}

function orderedList(...items: JSONContent[]): JSONContent {
  return { type: "orderedList", content: items };
}

function listItem(...content: JSONContent[]): JSONContent {
  return { type: "listItem", content };
}

function taskList(...items: JSONContent[]): JSONContent {
  return { type: "taskList", content: items };
}

function taskItem(checked: boolean, ...content: JSONContent[]): JSONContent {
  return { type: "taskItem", attrs: { checked }, content };
}

function horizontalRule(): JSONContent {
  return { type: "horizontalRule" };
}

function hardBreak(): JSONContent {
  return { type: "hardBreak" };
}

function image(
  src: string,
  alt?: string | null,
  title?: string | null
): JSONContent {
  return { type: "image", attrs: { src, alt: alt ?? null, title: title ?? null } };
}

describe("serializeMarkdown", () => {
  // ---------------------------------------------------------------------------
  // Headings
  // ---------------------------------------------------------------------------
  it("serializes H1 heading", () => {
    const md = serializeMarkdown(doc(heading(1, text("Title"))));
    expect(md.trim()).toBe("# Title");
  });

  it("serializes H2 through H6 headings", () => {
    for (let level = 2; level <= 6; level++) {
      const md = serializeMarkdown(doc(heading(level, text(`Level ${level}`))));
      const prefix = "#".repeat(level);
      expect(md.trim()).toBe(`${prefix} Level ${level}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Paragraphs
  // ---------------------------------------------------------------------------
  it("serializes a simple paragraph", () => {
    const md = serializeMarkdown(doc(paragraph(text("Hello world"))));
    expect(md.trim()).toBe("Hello world");
  });

  it("serializes multiple paragraphs", () => {
    const md = serializeMarkdown(
      doc(paragraph(text("First")), paragraph(text("Second")))
    );
    expect(md.trim()).toBe("First\n\nSecond");
  });

  // ---------------------------------------------------------------------------
  // Inline formatting
  // ---------------------------------------------------------------------------
  it("serializes bold text", () => {
    const md = serializeMarkdown(
      doc(paragraph(text("bold", [{ type: "bold" }])))
    );
    expect(md.trim()).toBe("**bold**");
  });

  it("serializes italic text", () => {
    const md = serializeMarkdown(
      doc(paragraph(text("italic", [{ type: "italic" }])))
    );
    expect(md.trim()).toBe("*italic*");
  });

  it("serializes strikethrough text", () => {
    const md = serializeMarkdown(
      doc(paragraph(text("deleted", [{ type: "strike" }])))
    );
    expect(md.trim()).toBe("~~deleted~~");
  });

  it("serializes inline code", () => {
    const md = serializeMarkdown(
      doc(paragraph(text("code", [{ type: "code" }])))
    );
    expect(md.trim()).toBe("`code`");
  });

  it("serializes bold+italic text", () => {
    const md = serializeMarkdown(
      doc(paragraph(text("both", [{ type: "bold" }, { type: "italic" }])))
    );
    // Should contain both ** and * markers around the text
    expect(md.trim()).toMatch(/\*{3}both\*{3}/);
  });

  // ---------------------------------------------------------------------------
  // Links
  // ---------------------------------------------------------------------------
  it("serializes a link", () => {
    const md = serializeMarkdown(
      doc(
        paragraph(
          text("click", [
            { type: "link", attrs: { href: "https://example.com" } },
          ])
        )
      )
    );
    expect(md.trim()).toBe("[click](https://example.com)");
  });

  it("serializes a link with title", () => {
    const md = serializeMarkdown(
      doc(
        paragraph(
          text("click", [
            {
              type: "link",
              attrs: { href: "https://example.com", title: "My Title" },
            },
          ])
        )
      )
    );
    expect(md.trim()).toBe('[click](https://example.com "My Title")');
  });

  it("serializes an autolink (text matches href) as angle-bracket URL", () => {
    const md = serializeMarkdown(
      doc(
        paragraph(
          text("Visit "),
          text("https://example.com", [
            { type: "link", attrs: { href: "https://example.com" } },
          ]),
          text(" for more.")
        )
      )
    );
    expect(md.trim()).toBe("Visit <https://example.com> for more.");
  });

  // ---------------------------------------------------------------------------
  // Code blocks
  // ---------------------------------------------------------------------------
  it("serializes a code block with language", () => {
    const md = serializeMarkdown(doc(codeBlock("const x = 1;", "javascript")));
    expect(md.trim()).toContain("```javascript");
    expect(md.trim()).toContain("const x = 1;");
  });

  it("serializes a code block without language", () => {
    const md = serializeMarkdown(doc(codeBlock("plain code")));
    expect(md.trim()).toContain("```");
    expect(md.trim()).toContain("plain code");
  });

  // ---------------------------------------------------------------------------
  // Blockquotes
  // ---------------------------------------------------------------------------
  it("serializes a blockquote", () => {
    const md = serializeMarkdown(
      doc(blockquote(paragraph(text("Quote text"))))
    );
    expect(md.trim()).toBe("> Quote text");
  });

  // ---------------------------------------------------------------------------
  // Lists
  // ---------------------------------------------------------------------------
  it("serializes an unordered list", () => {
    const md = serializeMarkdown(
      doc(
        bulletList(
          listItem(paragraph(text("Alpha"))),
          listItem(paragraph(text("Beta")))
        )
      )
    );
    expect(md.trim()).toContain("- Alpha");
    expect(md.trim()).toContain("- Beta");
  });

  it("serializes an ordered list", () => {
    const md = serializeMarkdown(
      doc(
        orderedList(
          listItem(paragraph(text("First"))),
          listItem(paragraph(text("Second")))
        )
      )
    );
    expect(md.trim()).toContain("1. First");
    expect(md.trim()).toContain("2. Second");
  });

  it("serializes a task list", () => {
    const md = serializeMarkdown(
      doc(
        taskList(
          taskItem(false, paragraph(text("Todo"))),
          taskItem(true, paragraph(text("Done")))
        )
      )
    );
    expect(md).toContain("[ ] Todo");
    expect(md).toContain("[x] Done");
  });

  it("serializes nested lists", () => {
    const md = serializeMarkdown(
      doc(
        bulletList(
          listItem(
            paragraph(text("Parent")),
            bulletList(
              listItem(paragraph(text("Child")))
            )
          )
        )
      )
    );
    expect(md).toContain("- Parent");
    expect(md).toContain("- Child");
  });

  // ---------------------------------------------------------------------------
  // Horizontal rule
  // ---------------------------------------------------------------------------
  it("serializes a horizontal rule", () => {
    const md = serializeMarkdown(doc(horizontalRule()));
    expect(md.trim()).toBe("---");
  });

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------
  it("serializes an image", () => {
    const md = serializeMarkdown(
      doc(image("https://example.com/img.png", "alt text"))
    );
    expect(md.trim()).toContain("![alt text](https://example.com/img.png)");
  });

  // ---------------------------------------------------------------------------
  // Frontmatter
  // ---------------------------------------------------------------------------
  it("serializes YAML frontmatter", () => {
    const md = serializeMarkdown(
      doc(
        codeBlock("title: Hello\nauthor: World", "yaml-frontmatter"),
        paragraph(text("Content"))
      )
    );
    expect(md).toContain("---");
    expect(md).toContain("title: Hello");
    expect(md).toContain("author: World");
    expect(md).toContain("Content");
  });

  // ---------------------------------------------------------------------------
  // Empty document
  // ---------------------------------------------------------------------------
  it("serializes an empty document", () => {
    const md = serializeMarkdown(doc(paragraph()));
    // Should not throw and produce a string
    expect(typeof md).toBe("string");
  });

  // ---------------------------------------------------------------------------
  // Blockquote containing list
  // ---------------------------------------------------------------------------
  it("serializes a blockquote containing a list", () => {
    const md = serializeMarkdown(
      doc(
        blockquote(
          bulletList(
            listItem(paragraph(text("A"))),
            listItem(paragraph(text("B")))
          )
        )
      )
    );
    expect(md).toContain("> ");
    expect(md).toContain("A");
    expect(md).toContain("B");
  });

  // ---------------------------------------------------------------------------
  // Mixed inline in paragraph
  // ---------------------------------------------------------------------------
  it("serializes mixed inline formatting in a paragraph", () => {
    const md = serializeMarkdown(
      doc(
        paragraph(
          text("Normal "),
          text("bold", [{ type: "bold" }]),
          text(" and "),
          text("italic", [{ type: "italic" }]),
          text(" text")
        )
      )
    );
    expect(md.trim()).toBe("Normal **bold** and *italic* text");
  });
});
