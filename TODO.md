Here's a comprehensive requirements list for a rendered Markdown editor plugin (VS Code):

---

## 1. Core Editing Requirements

### 1.1 WYSIWYG / Rendered Editing Mode

- [x] Edit Markdown content with live rendering (no separate preview pane required)
- [x] Hide raw Markdown syntax (`#`, `**`, `[]()`, etc.) during editing or show minimally/inline
- [x] Option to toggle between rendered view and raw Markdown source
- [x] Cursor positioning works correctly in rendered mode (not confused by concealed syntax)
- [x] Selection/highlighting works properly across rendered elements

### 1.2 Modal Behavior (optional but recommended)

- [x] Show rendered view in normal/read mode
- [ ] Show raw Markdown (or minimal syntax hints) in insert/edit mode
- [ ] Smooth transitions between modes without layout jumps

---

## 2. Standard Markdown Syntax Support

### 2.1 Block Elements

- [x] Headings (H1–H6) with visual hierarchy (font size, weight, color, spacing)
- [x] Paragraphs with proper line spacing
- [x] Block quotes with visual indentation/border
- [x] Code blocks with syntax highlighting (language-specific)
- [x] Horizontal rules (rendered as visual separators)
- [x] Lists:
  - [x] Unordered (bullet) lists
  - [x] Ordered (numbered) lists
  - [x] Nested lists with proper indentation
  - [x] Task lists / checkboxes (`- [ ]` / `- [x]`)

### 2.2 Inline Elements

- [x] Bold text (`**bold**` or `__bold__`)
- [x] Italic text (`*italic*` or `_italic_`)
- [x] Strikethrough (`~~text~~`)
- [x] Inline code (`` `code` ``)
- [x] Links (`[text](url)`) rendered as clickable hyperlinks
- [x] Auto-links (bare URLs rendered as links)
- [x] Images (`![alt](path)`) rendered inline
- [x] Special command to remove image (with confirmation)
- [x] set of buttons: Text stile (choose H1-H6/Text, Bold, Italic, lists, URL, etc)

### 2.3 Extended Markdown (GitHub Flavored Markdown)

- [x] Tables with proper column alignment and borders
- [x] Special menu to format table (add row, add column, etc)
- [ ] Footnotes
- [ ] Definition lists
- [x] Syntax highlighting in fenced code blocks with language identifiers

---

## 3. Image Handling (Critical for Obsidian-like workflow)

### 3.1 Image Display

- [x] Inline image rendering from local paths
- [x] Inline image rendering from URLs
- [x] Image sizing/scaling to fit editor width
- [x] Optional image captions (from alt text)
- [x] Support common formats: PNG, JPG, GIF, SVG, WebP

### 3.2 Image Insertion

- [x] **Paste from clipboard** (screenshot or copied image)
  - [x] Auto-save pasted image to configurable folder (e.g., `assets/`, `images/`, or per-file folders)
  - [x] Auto-insert Markdown image syntax with correct relative path
  - [x] Configurable naming scheme (timestamp, hash, custom pattern)
- [x] **Drag and drop** image files into editor
  - [x] Copy/move file to assets folder
  - [x] Insert Markdown reference
- [ ] Insert image via file picker dialog
- [x] Insert image via URL (direct link)

### 3.3 Image Management

- [x] Click on image to open in system viewer or enlarge
- [ ] Option to resize images (width/height attributes or CSS)
- [x] Delete image file when Markdown reference is removed (optional, with confirmation)
- [ ] Update image paths when files are moved/renamed

---

## 4. Heading and Formatting Commands

### 4.1 Heading Operations

- [x] Keyboard shortcut to convert current line to H1, H2, H3, H4, H5, H6
- [x] Increase/decrease heading level (e.g., `Ctrl+]` / `Ctrl+[`)
- [x] Remove heading formatting (convert back to paragraph)
- [x] Visual distinction for each heading level in rendered mode

### 4.2 Text Formatting Shortcuts

- [x] Bold: `Ctrl+B` / `Cmd+B`
- [x] Italic: `Ctrl+I` / `Cmd+I`
- [x] Strikethrough
- [x] Inline code
- [ ] Code block insertion with language selector

### 4.3 List Operations

- [x] Create unordered list
- [x] Create ordered list
- [x] Create task list
- [x] Toggle task checkbox (`[ ]` ↔ `[x]`)
- [x] Indent/outdent list items
- [x] Auto-continue lists on new line (hit Enter in list → new list item)

### 4.4 Block Operations

- [x] Insert block quote
- [x] Insert horizontal rule
- [x] Insert table (with size picker: rows × columns)
- [x] Table navigation (Tab to next cell, Shift+Tab to previous)
- [x] Add/remove table rows and columns

---

## 5. Link and Reference Handling

### 5.1 Internal Links (Obsidian-style)

- [ ] Support `[[Wiki Links]]` syntax (links to other Markdown files)
- [ ] Auto-complete file names when typing `[[`
- [ ] Click to follow internal links (open linked file)
- [ ] Create new file from unresolved link (e.g., click `[[Nonexistent File]]` → create it)
- [ ] Backlinks panel showing which files link to current file

### 5.2 Standard Markdown Links

- [x] Render `[text](url)` as clickable links
- [x] `Ctrl+Click` / `Cmd+Click` to open links in browser or editor
- [ ] Link auto-complete for local files
- [ ] Update links when files are renamed/moved (refactoring support)

### 5.3 Heading Links

- [ ] Support heading anchors (`[link](#heading-id)`)
- [ ] Auto-generate heading IDs
- [ ] Jump to heading within current file
- [ ] Jump to heading in other files (`[[file#heading]]`)

---

## 6. Document Navigation and Structure

### 6.1 Table of Contents

- [ ] Auto-generate ToC from headings
- [ ] Click on ToC entry to jump to section
- [ ] Update ToC automatically as headings change

### 6.2 Outline View

- [ ] Sidebar or panel showing document structure (headings hierarchy)
- [ ] Click outline item to navigate to that section

### 6.3 Folding

- [ ] Fold/unfold sections by heading level
- [ ] Fold code blocks, lists, block quotes

### 6.4 Breadcrumbs

- [ ] Show current heading/section in breadcrumb navigation
- [ ] Click breadcrumb to jump to parent sections

---

## 7. Search and Navigation

### 7.1 Within Document

- [ ] Standard find/replace (`Ctrl+F` / `Cmd+F`)
- [ ] Search works on rendered text (not just raw Markdown)
- [ ] Highlight all matches
- [ ] Navigate next/previous match

### 7.2 Across Workspace (multi-file)

- [ ] Full-text search across all Markdown files in workspace
- [ ] Search by tags (if tags supported)
- [ ] Search by backlinks
- [ ] Fuzzy file name search for quick navigation

---

## 8. Extended Features (Obsidian-like PKM)

### 8.1 Tags

- [ ] Support `#tag` syntax
- [ ] Clickable tags to show all files with that tag
- [ ] Tag auto-complete
- [ ] Tag cloud or tag browser panel

### 8.2 Metadata / Front Matter

- [x] Parse YAML front matter (title, date, tags, etc.)
- [ ] Display metadata in a dedicated section or panel
- [ ] Edit front matter in a form UI (optional)

### 8.3 Graph View

- [ ] Visual graph of note connections (linked files)
- [ ] Click node to open file
- [ ] Filter graph by tags or folders

### 8.4 Daily Notes

- [ ] Quick command to create/open daily note (e.g., `2026-02-09.md`)
- [ ] Template support for daily notes

### 8.5 Templates

- [ ] Template files for new notes
- [ ] Insert template content via command or picker
- [ ] Variable substitution in templates (date, time, title, etc.)

---

## 9. Math and Diagrams

### 9.1 Math Rendering

- [ ] Inline LaTeX math (`$...$`)
- [ ] Block LaTeX math (`$$...$$`)
- [ ] Use KaTeX or MathJax for rendering

### 9.2 Diagrams

- [ ] Mermaid diagram rendering in fenced code blocks
- [ ] PlantUML support (optional)
- [ ] Graphviz/DOT support (optional)

---

## 10. Performance and Scalability

### 10.1 Large Files

- [ ] Efficient rendering for files >10,000 lines
- [ ] Lazy rendering (only render visible viewport)
- [ ] Configurable file size limits for rendering

### 10.2 Large Workspaces

- [ ] Fast indexing of 1,000+ Markdown files
- [ ] Incremental indexing (only re-index changed files)
- [ ] Background indexing (doesn't block editor)

### 10.3 Responsiveness

- [ ] Typing latency <50ms even in long documents
- [ ] Smooth scrolling
- [ ] No UI freezing during file operations

---

## 11. Customization and Configuration

### 11.1 Appearance

- [x] Theme support (light and dark modes)
- [ ] Customizable fonts (editor font, heading fonts, code font)
- [ ] Customizable font sizes for each heading level
- [ ] Customizable colors (accent colors, link colors, etc.)
- [ ] Custom CSS injection for advanced styling

### 11.2 Behavior

- [ ] Configurable keybindings for all commands
- [ ] Toggle features on/off (e.g., disable math rendering, disable image rendering)
- [ ] Auto-save settings
- [ ] Spell check integration

### 11.3 File Management

- [x] Configurable assets folder location
- [x] Image file naming patterns
- [ ] Automatic file organization (e.g., move attachments with notes)

---

## 12. Accessibility

### 12.1 Keyboard Navigation

- [ ] All features accessible via keyboard shortcuts
- [ ] Logical tab order
- [ ] Focus indicators visible

### 12.2 Screen Reader Support

- [ ] Proper ARIA labels for UI elements
- [ ] Accessible image alt text
- [ ] Announce heading levels

### 12.3 Visual Accessibility

- [x] High contrast mode support
- [ ] Respects system font size settings
- [ ] Color blind friendly color schemes

---

## 13. Interoperability and Export

### 13.1 File Format Compatibility

- [x] Standard Markdown (.md) files
- [x] Compatible with GitHub Flavored Markdown
- [ ] Compatible with Obsidian syntax (for migration)
- [x] Compatible with other Markdown editors (no proprietary extensions)

### 13.2 Export Options

- [ ] Export to HTML
- [ ] Export to PDF
- [ ] Export to DOCX (optional)
- [ ] Export with embedded images or as zip with assets

### 13.3 Import

- [ ] Import from HTML
- [ ] Import from other note-taking apps (Bear, Notion, Evernote)

---

## 14. Collaboration and Sync (Optional, Advanced)

- nothing to be done

---

## 15. Developer Experience (Plugin Architecture)

### 15.1 For VS Code

- [x] Custom editor provider API implementation
- [x] Webview-based rendering or native editor extension
- [ ] Language server protocol (LSP) integration for Markdown features
- [ ] Extension API for third-party plugins to extend functionality

### 15.3 Testing and Quality

- [x] Unit tests for core rendering logic
- [x] Integration tests for file operations
- [ ] Performance benchmarks
- [ ] Automated regression testing

---

## 16. Documentation and Onboarding

### 16.1 User Documentation

- [ ] Getting started guide
- [ ] Keyboard shortcuts reference
- [ ] Configuration examples
- [ ] Video tutorials or GIFs

### 16.2 In-App Help

- [ ] Welcome screen with quick tips
- [ ] Command palette with searchable commands and descriptions
- [ ] Tooltips for UI elements
- [ ] Link to documentation from settings

---

## 17. Platform-Specific Requirements

### 17.1 VS Code

- [x] Works on Windows, macOS, Linux
- [ ] Works in VS Code web (vscode.dev) if possible
- [ ] Works in VS Codium and other VS Code forks
- [x] Respects VS Code theme and color tokens

---

## Priority Tiers (Suggested)

### MVP (Minimum Viable Product)

1. Rendered editing mode with syntax concealment
2. Headings, bold, italic, lists, links, images
3. Paste images from clipboard with auto-save
4. Keyboard shortcuts for headings and formatting
5. Toggle between rendered and raw mode

### V1 (Full Feature Parity with Obsidian basics)

1. Tables, task lists, code blocks with syntax highlighting
2. Internal links (`[[wiki links]]`)
3. File navigation and search
4. Table of contents / outline view
5. Math rendering (LaTeX)

### V2 (Advanced PKM Features)

1. Backlinks and graph view
2. Tags and metadata
3. Templates and daily notes
4. Mermaid diagrams
5. Performance optimization for large vaults

### V3 (Collaboration and Ecosystem)

1. Git integration
2. Export to PDF/HTML/DOCX
3. Plugin API for extensibility
4. Mobile companion app sync (if applicable)
5. Real-time collaboration

---

This list should serve as a comprehensive checklist for scoping, prioritizing, and building your plugin. Start with the MVP, then iterate based on user feedback.
