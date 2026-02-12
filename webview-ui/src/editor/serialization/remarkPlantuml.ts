/**
 * Remark plugin that pre-processes markdown to convert raw @startuml/@enduml
 * blocks into fenced code blocks with lang "plantuml" and a special meta
 * marker so we can restore the original format on serialization.
 *
 * It works as a pre-processor on the raw markdown string (before remark-parse)
 * rather than an AST transform, because remark-parse would treat @startuml
 * lines as ordinary paragraphs and split the content across multiple nodes.
 *
 * The meta marker `originalFormat:startuml` is preserved on the MDAST code
 * node's `meta` property through the round-trip.
 */

/**
 * Convert raw @startuml/@enduml blocks to fenced ```plantuml blocks
 * so remark-parse can handle them as code blocks.
 *
 * The content between @startuml and @enduml is preserved exactly,
 * including the @startuml/@enduml markers themselves (they are part
 * of the PlantUML source).  A meta tag `originalFormat:startuml` is
 * added so the serializer knows to output @startuml/@enduml instead
 * of fenced code.
 */
export function preprocessPlantuml(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;
  let insideFence = false;

  while (i < lines.length) {
    const trimmed = lines[i].trimStart();

    // Track fenced code blocks so we don't match @startuml inside them
    if (!insideFence && /^(`{3,}|~{3,})/.test(trimmed)) {
      insideFence = true;
      result.push(lines[i]);
      i++;
      continue;
    }
    if (insideFence && /^(`{3,}|~{3,})\s*$/.test(trimmed)) {
      insideFence = false;
      result.push(lines[i]);
      i++;
      continue;
    }

    if (!insideFence && trimmed.startsWith("@startuml")) {
      // Collect everything until @enduml
      const blockLines: string[] = [lines[i]];
      i++;
      let foundEnd = false;
      while (i < lines.length) {
        blockLines.push(lines[i]);
        if (lines[i].trimStart().startsWith("@enduml")) {
          foundEnd = true;
          i++;
          break;
        }
        i++;
      }
      if (!foundEnd) {
        // No @enduml found — just output as-is
        result.push(...blockLines);
      } else {
        // Wrap in a fenced code block with meta marker
        result.push("```plantuml originalFormat:startuml");
        // Include the full @startuml...@enduml content
        result.push(...blockLines);
        result.push("```");
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}

/**
 * Post-process serialized markdown to convert fenced ```plantuml blocks
 * that have `originalFormat:startuml` meta back to raw @startuml/@enduml
 * blocks.
 */
export function postprocessPlantuml(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trimStart();
    // Match ```plantuml originalFormat:startuml (the serializer outputs this)
    if (/^```plantuml\s+originalFormat:startuml\s*$/.test(trimmed)) {
      // Skip the opening fence
      i++;
      // Collect content until closing ```
      const blockLines: string[] = [];
      while (i < lines.length) {
        if (lines[i].trimStart() === "```") {
          i++;
          break;
        }
        blockLines.push(lines[i]);
        i++;
      }
      // Output the raw block content (which already contains @startuml/@enduml)
      result.push(...blockLines);
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}
