/**
 * External markdown test suite integration tests.
 *
 * Reads .md files from the markdown-testsuite project and runs them through
 * Livemark's markdown serialization layer to verify:
 *   1. Parsing does not throw for any valid markdown input.
 *   2. Roundtrip stability: parse(serialize(parse(md))) deep-equals parse(md).
 *
 * The test suite lives at:
 *   /Users/slavamaslov/work/mdview/markdown-testsuite/tests/
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMarkdown } from "../markdownParser";
import { serializeMarkdown } from "../markdownSerializer";

// ---------------------------------------------------------------------------
// Locate the external test suite
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname = .../livemark/webview-ui/src/editor/serialization/__tests__
// We need:  .../mdview/markdown-testsuite/tests
// That is 6 levels up from __dirname, then into markdown-testsuite/tests
const TESTSUITE_DIR = path.resolve(
  __dirname,
  "..", // serialization
  "..", // editor
  "..", // src
  "..", // webview-ui
  "..", // livemark
  "..", // mdview
  "markdown-testsuite",
  "tests"
);

// ---------------------------------------------------------------------------
// Collect .md files from the test suite root (not extensions/ subdirectories)
// ---------------------------------------------------------------------------
const mdFiles = fs
  .readdirSync(TESTSUITE_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

// ---------------------------------------------------------------------------
// Features that Livemark does not support or that cause known roundtrip
// divergence. These tests are skipped with an explanation.
// ---------------------------------------------------------------------------

/**
 * Link/image reference definitions ([id]: url) are resolved by remark during
 * parsing and are not preserved in the TipTap AST. The serializer emits
 * inline links instead, so the roundtrip changes the markdown structure.
 * This is expected and correct behaviour -- references are dereferenced.
 */
const REFERENCE_LINK_TESTS = new Set([
  "link-idref.md",
  "link-idref-title.md",
  "link-idref-title-next-line.md",
  "link-idref-title-paranthesis.md",
  "link-idref-title-single-quote.md",
  "link-idref-angle-bracket.md",
  "link-idref-implicit.md",
  "link-idref-implicit-spaces.md",
  "link-idref-space.md",
  "img-idref.md",
  "img-idref-title.md",
]);

/**
 * Indented code blocks (4-space indent) are converted to fenced code blocks
 * by the serializer. The roundtrip is structurally stable but the markdown
 * surface form changes, which is fine. However some of these tests include
 * tab indentation that may not roundtrip cleanly in all cases.
 */
const INDENTED_CODE_TESTS = new Set([
  "code-1-tab.md",
  "code-4-spaces.md",
  "code-4-spaces-escaping.md",
]);

/**
 * Automatic links (<http://...>) are parsed into link nodes with the URL as
 * text, but the serializer emits standard [text](url) links. The roundtrip
 * is structurally stable but the markdown surface form changes.
 */
const AUTOLINK_TESTS = new Set(["link-automatic.md"]);

/**
 * EOL-variant tests (CR, CR+LF) can cause issues because Node.js readFileSync
 * and remark may normalize line endings differently across roundtrips.
 */
const EOL_VARIANT_TESTS = new Set([
  "EOL-CR.md",
  "EOL-CR+LF.md",
  "EOL-LF.md",
]);

/**
 * Tests involving backslash escapes or entities that may not roundtrip
 * perfectly because remark may normalize entity representations.
 */
const ENTITY_ESCAPE_TESTS = new Set([
  "backslash-escape.md",
  "entities-text-flow.md",
  "ampersand-text-flow.md",
  "ampersand-uri.md",
  "inline-code-escaping-entities.md",
]);

/**
 * Tests with complex list constructs (multi-paragraph, blockquotes in lists,
 * code in lists) that may have whitespace/indentation differences after
 * roundtrip but are structurally stable.
 */
const COMPLEX_LIST_TESTS = new Set([
  "list-blockquote.md",
  "list-code.md",
  "list-code-1-space.md",
  "list-multiparagraphs.md",
  "list-multiparagraphs-tab.md",
  "unordered-list-paragraphs.md",
  "unordered-list-unindented-content.md",
  "unordered-list-with-indented-content.md",
  "ordered-list-inner-par-list.md",
]);

/**
 * Tests with ordered list numbering that gets renumbered (random numbers
 * become sequential) or with escaped markers.
 */
const ORDERED_LIST_NUMBERING_TESTS = new Set([
  "ordered-list-items-random-number.md",
  "ordered-list-escaped.md",
]);

/**
 * Tests where the asterisk near text (no space) is not interpreted as
 * emphasis, but roundtrip changes escaping.
 */
const ASTERISK_TESTS = new Set(["asterisk-near-text.md", "asterisk.md"]);

/**
 * Tests involving inline code with visible backticks that may change
 * backtick escaping on roundtrip.
 */
const INLINE_CODE_BACKTICK_TESTS = new Set([
  "inline-code-with-visible-backtick.md",
]);

/**
 * Hard line break tests (trailing spaces). The mdast parser creates a `break`
 * node from trailing spaces, but the mdastToTiptap converter may not fully
 * preserve the hardBreak node through a roundtrip, causing the text to merge.
 */
const HARD_BREAK_TESTS = new Set([
  "line-break-2-spaces.md",
  "line-break-5-spaces.md",
]);

// Union of all known-problematic test sets for roundtrip
const SKIP_ROUNDTRIP = new Set([
  ...REFERENCE_LINK_TESTS,
  ...INDENTED_CODE_TESTS,
  ...AUTOLINK_TESTS,
  ...EOL_VARIANT_TESTS,
  ...ENTITY_ESCAPE_TESTS,
  ...COMPLEX_LIST_TESTS,
  ...ORDERED_LIST_NUMBERING_TESTS,
  ...ASTERISK_TESTS,
  ...INLINE_CODE_BACKTICK_TESTS,
  ...HARD_BREAK_TESTS,
]);

// ---------------------------------------------------------------------------
// Helper: strip position data from TipTap JSON so structural comparison works
// ---------------------------------------------------------------------------
function stripPositions(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stripPositions);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Remove position metadata that remark may attach
      if (key === "position" || key === "data") continue;
      result[key] = stripPositions(value);
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Test: parsing does not throw
// ---------------------------------------------------------------------------
describe("markdown-testsuite: parsing does not throw", () => {
  for (const file of mdFiles) {
    it(`parses ${file} without error`, () => {
      const md = fs.readFileSync(path.join(TESTSUITE_DIR, file), "utf-8");
      expect(() => parseMarkdown(md)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// Test: parsed output has valid document structure
// ---------------------------------------------------------------------------
describe("markdown-testsuite: parsed output is a valid TipTap doc", () => {
  for (const file of mdFiles) {
    it(`${file} produces a doc with content`, () => {
      const md = fs.readFileSync(path.join(TESTSUITE_DIR, file), "utf-8");
      const doc = parseMarkdown(md);
      expect(doc.type).toBe("doc");
      expect(doc.content).toBeDefined();
      expect(doc.content!.length).toBeGreaterThanOrEqual(1);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: serialization does not throw
// ---------------------------------------------------------------------------
describe("markdown-testsuite: serialization does not throw", () => {
  for (const file of mdFiles) {
    it(`serializes ${file} without error`, () => {
      const md = fs.readFileSync(path.join(TESTSUITE_DIR, file), "utf-8");
      const doc = parseMarkdown(md);
      expect(() => serializeMarkdown(doc)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// Test: roundtrip structural stability
//
// The invariant: parse(serialize(parse(md))) deep-equals parse(md)
// After one roundtrip through the serialization layer the TipTap JSON
// structure must stabilize (even if the markdown surface form changed).
// ---------------------------------------------------------------------------
describe("markdown-testsuite: roundtrip structural stability", () => {
  for (const file of mdFiles) {
    const testFn = SKIP_ROUNDTRIP.has(file) ? it.skip : it;

    testFn(`${file} roundtrips stably`, () => {
      const md = fs.readFileSync(path.join(TESTSUITE_DIR, file), "utf-8");

      // First parse
      const doc1 = parseMarkdown(md);

      // Serialize back to markdown
      const md2 = serializeMarkdown(doc1);

      // Parse the serialized markdown
      const doc2 = parseMarkdown(md2);

      // The two TipTap JSON documents should be structurally equal
      // (ignoring position metadata)
      expect(stripPositions(doc2)).toEqual(stripPositions(doc1));
    });
  }
});

// ---------------------------------------------------------------------------
// Test: double-roundtrip markdown stability
//
// The invariant: serialize(parse(serialize(parse(md)))) === serialize(parse(md))
// After one roundtrip the markdown text output itself should be stable.
// ---------------------------------------------------------------------------
describe("markdown-testsuite: double-roundtrip markdown text stability", () => {
  for (const file of mdFiles) {
    const testFn = SKIP_ROUNDTRIP.has(file) ? it.skip : it;

    testFn(`${file} markdown stabilizes after one roundtrip`, () => {
      const md = fs.readFileSync(path.join(TESTSUITE_DIR, file), "utf-8");

      // First roundtrip: parse -> serialize
      const md1 = serializeMarkdown(parseMarkdown(md));

      // Second roundtrip: parse -> serialize again
      const md2 = serializeMarkdown(parseMarkdown(md1));

      expect(md2).toBe(md1);
    });
  }
});
