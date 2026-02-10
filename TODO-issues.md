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

### ~~4. `setActiveWebview` Is a Global Singleton~~ ✅ FIXED

**Files:** `src/commands.ts`, `src/LivemarkEditorProvider.ts`

**Fix:** Removed the `setActiveWebview(postMessage)` call at editor open time. Now the active webview is only set via `onDidChangeViewState` (on focus), with an additional check at creation time if the panel is already active. This eliminates the window where commands could route to the wrong panel.

---

### ~~5. Source Mode Drops Commands and Has Timing Edge Case~~ ✅ FIXED

**Files:** `webview-ui/src/App.tsx`

**Fix:** Added `isSourceModeRef` to track source mode without stale closures. `handleCommand` now handles `toggleSourceMode` before checking for the editor, so it works in both modes. Other formatting commands are intentionally skipped in source mode (they have no meaning in a textarea). This also fixes issue #8 (stale closure).

---

### ~~6. Two Copies of `messages.ts` — Manual Sync~~ ✅ FIXED

**Files:** `src/messages.ts`, `webview-ui/src/messages.ts`

**Fix:** Made `src/messages.ts` the single source of truth. The webview's `messages.ts` is now a one-line re-export (`export * from "../../src/messages"`) instead of a full duplicate. The webview `tsconfig.json` includes the extension source file for type-checking. Both Vite and esbuild resolve the cross-directory import at bundle time, so any drift between sides is now impossible.

---

### ~~7. Image URL Un-resolution Is Fragile~~ ✅ FIXED

**File:** `webview-ui/src/editor/serialization/tiptapToMdast.ts`

**Fix:** The inline image serialization path in `convertInlineContent` now uses `originalSrc` (the preserved relative path) before falling back to `unresolveImageUrl`, matching the block-level image handling. Also removed the unreliable "find relative portion by common segments" heuristic from `unresolveImageUrl`, simplifying it to direct base-URI prefix stripping. With `originalSrc` now reliably used in both code paths, the fragile heuristic is no longer needed.

---

## Medium

### ~~8. Stale Closure in App.tsx Message Handler~~ ✅ FIXED

**File:** `webview-ui/src/App.tsx`

**Fix:** Added `isSourceModeRef` ref that stays in sync with state. `handleCommand` now reads from refs instead of relying on closure state, eliminating stale closure issues during rapid mode switches. Fixed together with issue #5.

---

### ~~9. Config Change Suppression Uses `setTimeout`~~ ✅ FIXED

**File:** `src/LivemarkEditorProvider.ts`

**Fix:** Replaced the timing-based `setTimeout` boolean flag with a counter (`pendingLayoutChanges`). The counter is incremented once per config key being written, and decremented in the `onDidChangeConfiguration` handler. This deterministically suppresses exactly the right number of echoed config change events regardless of system timing.

---

### ~~10. `ImageHandler.ts` — Duplicated Path Generation Logic~~ ✅ FIXED

**File:** `src/ImageHandler.ts`

**Fix:** Extracted a shared `computeImagePaths()` helper that returns both the absolute path and the document-relative path. Both `generateImagePath` and `saveImage` now delegate to this single function, eliminating the duplicated workspace resolution, folder expansion, and name pattern logic.

---

### ~~11. ImageWithCaption / ImageNodeView Bypass Message Protocol~~ ✅ FIXED

**Files:** `webview-ui/src/editor/extensions/ImageWithCaption.ts`, `webview-ui/src/editor/extensions/ImageNodeView.tsx`, `webview-ui/src/editor/extensions/index.ts`, `webview-ui/src/editor/LivemarkEditor.tsx`, `webview-ui/src/App.tsx`

**Fix:** Added `onDeleteImage` and `onOpenImage` callbacks to the `ImageWithCaption` extension options (same pattern as `ImagePaste.onImagePaste`). These are wired from `App.tsx → LivemarkEditor → createExtensions → ImageWithCaption`. The `ImageNodeView` accesses them via `extension.options`. Removed all direct `getVSCodeApi().postMessage(...)` calls from both files — all messages now flow through the centralized `postMessage` from `useVSCodeMessaging`.

---

### ~~12. No Error Boundary in Webview React App~~ ✅ FIXED

**File:** `webview-ui/src/main.tsx`, `webview-ui/src/components/ErrorBoundary.tsx`

**Fix:** Added a React `ErrorBoundary` component that catches render errors and displays a styled error screen with the error message, stack trace, and a "Try Again" button. Wraps `<App />` in `main.tsx` so serialization crashes no longer white-screen the editor.

---

## Low

### ~~13. `HighContrastLight` Theme Mapped to "light"~~ ✅ FIXED

**File:** `src/ThemeSync.ts`, `src/messages.ts`, `webview-ui/src/messages.ts`, `webview-ui/src/hooks/useTheme.ts`

**Fix:** Added `"high-contrast-light"` to the `ThemeKind` union across all files. `HighContrastLight` now maps to its own dedicated mode instead of falling through to `"light"`. The `data-theme` attribute on the webview root is set to `"high-contrast-light"` for these themes, enabling targeted CSS overrides.

---

### 14. CSP Allows `'unsafe-inline'` for Styles

**File:** `src/LivemarkEditorProvider.ts` (L260)

`style-src` includes `'unsafe-inline'`, necessary for TipTap/CSS-in-JS but weakening CSP. Acceptable trade-off for now; worth revisiting if a nonce-based approach becomes feasible.

**Risk:** Minor CSP weakness.

---

### ~~15. Toolbar Renders as Fragment~~ ✅ FIXED

**File:** `webview-ui/src/components/Toolbar.tsx`

**Fix:** Replaced the `<>` fragment with a `<div className="livemark-toolbar-group" style={{ display: "contents" }}>` wrapper. `display: contents` means the wrapper doesn't affect flex layout (children behave as if they're direct children of the parent), while providing a real DOM node for React and future layout changes.

---

### 16. `supportsMultipleEditorsPerDocument: false`

**File:** `src/LivemarkEditorProvider.ts` (L28)

Users cannot split-view two Livemark editors on the same file. Enabling this would require multi-webview sync per document, which the current architecture doesn't support. Acceptable for now.

**Risk:** Feature limitation; no bug.

---

## Summary

| Severity | Count | Fixed | Key Themes |
|----------|-------|-------|------------|
| Critical | 3 | 2 | Sync race conditions, data loss, undo conflict |
| High | 4 | 4 | Multi-editor routing, source mode gaps, message drift, image paths |
| Medium | 5 | 5 | Stale closures, timing hacks, code duplication, error handling |
| Low | 4 | 2 | Accessibility, CSP, layout, feature limits |
