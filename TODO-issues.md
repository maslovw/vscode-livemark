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

### 11. ImageWithCaption / ImageNodeView Bypass Message Protocol

**Files:** `webview-ui/src/editor/extensions/ImageWithCaption.ts` (L43), `webview-ui/src/editor/extensions/ImageNodeView.tsx` (L37)

Image deletion directly calls `getVSCodeApi().postMessage(...)` instead of using the centralized `postMessage` from `useVSCodeMessaging`. This bypasses any future middleware, logging, or message validation.

**Risk:** Inconsistent message path; harder to add cross-cutting concerns.

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

| Severity | Count | Fixed | Key Themes |
|----------|-------|-------|------------|
| Critical | 3 | 2 | Sync race conditions, data loss, undo conflict |
| High | 4 | 2 | Multi-editor routing, source mode gaps, message drift, image paths |
| Medium | 5 | 4 | Stale closures, timing hacks, code duplication, error handling |
| Low | 4 | 1 | Accessibility, CSP, layout, feature limits |
