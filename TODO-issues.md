# Livemark — Architecture Issues

Identified during architecture review. No fixes applied — tracking only.

---

## Critical

### ~~1. Circular Update Race Condition — Single Boolean Flag~~ ✅ FIXED

**Files:** `src/LivemarkEditorProvider.ts`, `webview-ui/src/hooks/useEditorContent.ts`

**Fix:** Extension side: replaced single-shot boolean with a lifecycle-controlled flag (`suppressExternalChanges`) that stays `true` for the entire `applyEdit` await — all `onDidChangeTextDocument` events during the edit are suppressed. Webview side: replaced boolean `suppressNextUpdate` with a numeric counter (`suppressUpdateCount`) that correctly handles multiple `onUpdate` callbacks from a single `setContent`.

---

### ~~2. 300ms Debounce Can Lose Content on Tab Close~~ ✅ FIXED

**File:** `webview-ui/src/hooks/useEditorContent.ts`

**Fix:** Added a `flush()` function that immediately cancels any pending debounce timer and sends the current editor content. Registered a `beforeunload` event listener inside the hook that calls `flush()` when the webview is torn down, and also flushes on React unmount via the `useEffect` cleanup. The hook now tracks the editor instance via a ref and exposes `flush` to callers.

---

### 3. Dual Undo Stacks — No Synchronization

**Files:** `src/LivemarkEditorProvider.ts`, webview TipTap editor

TipTap maintains its own undo history; `vscode.workspace.applyEdit` pushes to VS Code's separate undo stack. Ctrl+Z in the webview triggers TipTap undo → content change → `applyEdit`. But VS Code Command Palette "Undo" undoes the last `applyEdit` → `onDidChangeTextDocument` → pushes old content to webview → new `applyEdit`. The two stacks are not coordinated.

**Risk:** Confusing undo behavior; potential content oscillation via undo.

---

## High

### 4. `setActiveWebview` Is a Global Singleton

**Files:** `src/commands.ts`, `src/LivemarkEditorProvider.ts` (L64, L237)

A single `activePostMessage` function pointer stores the "current" webview. `resolveCustomTextEditor` calls `setActiveWebview(postMessage)` immediately on open, meaning the **last opened** editor always captures commands — not the currently focused one. The `onDidChangeViewState` handler corrects this on focus, but there's a window between open and first focus where commands route to the wrong panel.

**Risk:** Formatting commands (bold, italic, headings) applied to the wrong editor when multiple Livemark tabs are open.

---

### 5. Source Mode Drops Commands and Has Timing Edge Case

**Files:** `webview-ui/src/App.tsx` (L64, L217–L222)

- `ext:executeCommand` arriving in source mode calls `handleCommand` on `editorRef.current`, which is `null` (TipTap is unmounted). Commands are silently dropped.
- When switching back to rendered mode: `toggleSourceMode` calls `loadContent(editor, sourceText)`, but if `editorRef.current` is momentarily `null` (stale ref from unmounted editor), it falls through to `pendingContent`. The timing between `setIsSourceMode(false)` and React re-rendering `<LivemarkEditor>` is not guaranteed.

**Risk:** Lost commands; potential blank editor after source→rendered switch.

---

### 6. Two Copies of `messages.ts` — Manual Sync

**Files:** `src/messages.ts`, `webview-ui/src/messages.ts`

These are separate files that must be kept in sync by hand. No build-time validation, no shared package, no codegen. A drift (e.g., adding a field to one side but not the other) causes silent runtime failures with no type error at build time.

**Risk:** Runtime message handling bugs after one-sided edits.

---

### 7. Image URL Un-resolution Is Fragile

**File:** `webview-ui/src/editor/serialization/tiptapToMdast.ts` (L22–L80)

`unresolveImageUrl` uses a multi-strategy approach: URL parsing, pathname matching, segment heuristics, prefix stripping. The fallback heuristic (finding "relative portions by common segments") is unreliable for deeply nested documents. The `originalSrc` attribute was added to bypass this, but images inserted via the toolbar URL dialog set `originalSrc = url` identically to `src`, which is correct for remote URLs but wrong for user-typed relative paths.

**Risk:** Corrupted image paths on save for edge-case directory structures.

---

## Medium

### 8. Stale Closure in App.tsx Message Handler

**File:** `webview-ui/src/App.tsx` (L37, L149)

The `useCallback` message handler depends on `[isSourceMode]`, but `handleCommand` has an empty `[]` dependency array. While refs protect against stale editor references, `isSourceMode` could be stale between React re-renders if a message arrives mid-transition.

**Risk:** Incorrect message routing during rapid mode switches.

---

### 9. Config Change Suppression Uses `setTimeout`

**File:** `src/LivemarkEditorProvider.ts` (L200)

When the webview sends `webview:setLayout`, the extension suppresses the resulting config change echo with `setTimeout(() => { suppressLayoutChange = false; }, 200)`. Timing-based suppression is unreliable — if `onDidChangeConfiguration` fires after 200ms (system load, slow disk), the layout change bounces back.

**Risk:** Layout flickering under load.

---

### 10. `ImageHandler.ts` — Duplicated Path Generation Logic

**File:** `src/ImageHandler.ts` (L26–L48 vs L63–L85)

`generateImagePath` and `saveImage` contain **identical** path computation code: workspace folder resolution, `{mdfilepath}` replacement, name pattern substitution, timestamp generation. Any fix must be applied in two places.

**Risk:** Path generation bugs from inconsistent edits.

---

### 11. ImageWithCaption / ImageNodeView Bypass Message Protocol

**Files:** `webview-ui/src/editor/extensions/ImageWithCaption.ts` (L43), `webview-ui/src/editor/extensions/ImageNodeView.tsx` (L37)

Image deletion directly calls `getVSCodeApi().postMessage(...)` instead of using the centralized `postMessage` from `useVSCodeMessaging`. This bypasses any future middleware, logging, or message validation.

**Risk:** Inconsistent message path; harder to add cross-cutting concerns.

---

### 12. No Error Boundary in Webview React App

**File:** `webview-ui/src/main.tsx`

`<App />` renders with no React error boundary. A serialization crash (malformed markdown → MDAST conversion failure) unmounts the entire editor — white screen, no recovery, no error message.

**Risk:** Unrecoverable editor crash on malformed input.

---

## Low

### 13. `HighContrastLight` Theme Mapped to "light"

**File:** `src/ThemeSync.ts` (L8)

`HighContrastLight` maps to `"light"` instead of a dedicated mode. Users relying on high-contrast light themes get insufficient contrast.

**Risk:** Accessibility gap for high-contrast light users.

---

### 14. CSP Allows `'unsafe-inline'` for Styles

**File:** `src/LivemarkEditorProvider.ts` (L260)

`style-src` includes `'unsafe-inline'`, necessary for TipTap/CSS-in-JS but weakening CSP. Acceptable trade-off for now; worth revisiting if a nonce-based approach becomes feasible.

**Risk:** Minor CSP weakness.

---

### 15. Toolbar Renders as Fragment

**File:** `webview-ui/src/components/Toolbar.tsx` (L166)

Returns `<>` fragment instead of a wrapper div. All buttons are direct children of the parent container. Already noted in CLAUDE.md as a known constraint — fragile for future layout changes.

**Risk:** Layout brittleness.

---

### 16. `supportsMultipleEditorsPerDocument: false`

**File:** `src/LivemarkEditorProvider.ts` (L28)

Users cannot split-view two Livemark editors on the same file. Enabling this would require multi-webview sync per document, which the current architecture doesn't support. Acceptable for now.

**Risk:** Feature limitation; no bug.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 3 (2 fixed) | Sync race conditions, data loss, undo conflict |
| High | 4 | Multi-editor routing, source mode gaps, message drift, image paths |
| Medium | 5 | Stale closures, timing hacks, code duplication, error handling |
| Low | 4 | Accessibility, CSP, layout, feature limits |
