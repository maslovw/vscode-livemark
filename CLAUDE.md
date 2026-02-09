# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**
Always keep TODO.md in sync! Only tick if task can be fully closed!

## Build Commands

Two separate build systems — run from `livemark/` directory:

```bash
# Extension (Node.js, esbuild → dist/extension.js)
node esbuild.mjs              # production build
node esbuild.mjs --watch      # watch mode

# Webview (React+TipTap, Vite → dist-webview/)
cd webview-ui && npx vite build

# Both together
npm run build

# Package as VSIX
npx vsce package --no-dependencies

# Install to VS Code
/opt/homebrew/bin/code --install-extension livemark-0.1.0.vsix --force
```

## Testing

```bash
# Unit tests (vitest, webview serialization)
cd webview-ui && npx vitest run

# Single test file
cd webview-ui && npx vitest run src/editor/serialization/__tests__/roundtrip.test.ts

# Type-check webview
cd webview-ui && npx tsc --noEmit

# Integration tests (VS Code extension host, Mocha TDD UI)
npm run build:tests && node dist/test/runTest.js
```

## Architecture

**VS Code WYSIWYG Markdown editor** using `CustomTextEditorProvider`. The TextDocument is source of truth; the webview is a rendered view synced via message passing.

### Two Separate Codebases

| | Extension (`src/`) | Webview (`webview-ui/src/`) |
|---|---|---|
| Runtime | Node.js | Browser (VS Code webview) |
| Bundler | esbuild → `dist/` | Vite → `dist-webview/` |
| Framework | VS Code API | React 18 + TipTap 2.x |
| Entry | `extension.ts` | `main.tsx` → `App.tsx` |
| Tests | Mocha + @vscode/test-electron | Vitest |

### Message Passing Protocol

Extension and webview communicate via typed messages (`messages.ts` exists on both sides, must stay in sync):

```
Extension → Webview:  ext:init, ext:documentChanged, ext:themeChanged, ext:imageSaved, ext:executeCommand
Webview → Extension:  webview:ready, webview:contentChanged, webview:pasteImage, webview:openLink
```

**Circular update prevention**: `suppressNextExternalChange` flag in the provider, `suppressNextUpdate` ref in `useEditorContent`. Content changes debounced at 300ms.

### Markdown Serialization Pipeline (Critical Path)

Bidirectional conversion through remark MDAST as intermediate:

```
markdown string ←→ remark MDAST ←→ TipTap JSON
```

- `markdownParser.ts`: markdown → MDAST (remark-parse + remark-gfm) → TipTap JSON (mdastToTiptap)
- `markdownSerializer.ts`: TipTap JSON → MDAST (tiptapToMdast) → markdown (remark-stringify)
- `mdastToTiptap.ts`: MDAST nodes → TipTap JSONContent. Images in paragraphs are extracted as block-level nodes. Relative image URLs resolved against `baseUri`.
- `tiptapToMdast.ts`: TipTap JSONContent → MDAST nodes. Image URLs have `baseUri` prefix stripped back to relative paths.

### Image URL Resolution

Relative image paths (e.g., `img/photo.png`) can't be loaded by the webview directly. The extension sends `baseUri` (webview URI of document directory) in the init message. During parsing, `resolveImageUrl()` prepends it; during serialization, `unresolveImageUrl()` strips it.

### Editor Initialization Timing

Race condition: `ext:init` may arrive before TipTap mounts. Handled by `pendingContent` ref in `App.tsx` + TipTap `onCreate` callback in `LivemarkEditor.tsx`.

## Key Gotchas

- `remark-stringify` options need `as any` cast — typing mismatch with actual API
- Toolbar component uses `<>` fragment, not its own wrapper div (avoid nested `.livemark-toolbar`)
- Vite build must run from `webview-ui/` directory
- `retainContextWhenHidden: true` keeps webview state when tab loses focus
- `strong: "*"` not `"**"` — remark-stringify doubles the character automatically
- Integration tests use Mocha TDD UI (`suite`/`test`), not BDD (`describe`/`it`)
- Extension esbuild externalizes `vscode`; test builds externalize `mocha`, `glob`, `assert` too
