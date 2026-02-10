# Livemark

A WYSIWYG Markdown editor extension for Visual Studio Code, built with TipTap 2.x and React 18. Livemark lets you edit `.md` and `.markdown` files in a rich-text interface while keeping the underlying Markdown source as the single source of truth.

Livemark registers with `"priority": "option"`, so it never hijacks your default Markdown experience -- it appears in the **Open With...** menu and you choose when to use it.

## Features

- **Rich-text editing** -- headings (1-3), bold, italic, strikethrough, inline code, code blocks, links, images, ordered/unordered lists, task lists, and blockquotes, all powered by TipTap.
- **Lossless Markdown roundtrip** -- content flows through a remark/unified pipeline (with GFM and frontmatter support) to an MDAST, then to TipTap JSON, and back again.
- **Image paste and drag-drop** -- paste or drag images directly into the editor. They are saved to a configurable folder and inserted as relative Markdown image links.
- **VS Code theme integration** -- the editor adapts to light, dark, and high-contrast themes automatically.
- **Source / rendered mode toggle** -- switch between WYSIWYG and raw Markdown with a single shortcut.
- **Formatting toolbar** -- a compact toolbar provides quick access to common formatting actions.
- **Keyboard shortcuts** -- all major formatting operations have keybindings that activate only when the Livemark editor is focused.
- **Context menu entry** -- right-click any `.md` or `.markdown` file in the Explorer and choose **Open with Livemark**.

## Installation

Livemark is not yet published to the VS Code Marketplace. You can install it from source:

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd vscode-livemark
   ```

2. **Install dependencies:**

   ```bash
   npm install
   cd webview-ui
   npm install
   cd ..
   ```

3. **Build, package, and install:**

   ```bash
   # Build the extension and webview
   npm run build
   
   # Package into .vsix file
   npm run package -- --allow-missing-repository
   
   # Install to VS Code (use --force to update existing installation)
   code --install-extension livemark-<version>.vsix --force
   ```

   Check the `version` field in `package.json` to find the current version number.

4. **Reload VS Code** -- after installation, reload VS Code for the extension to activate.

5. **Use the extension** -- open any `.md` file and choose **Open With... > Livemark** from the editor title bar or the Explorer context menu.

### Development mode

For active development, you can run the extension in debug mode:

1. **Open the project folder** in VS Code.
2. **Press F5** to start the Extension Development Host.
3. In the Development Host, open any `.md` file and choose **Open With... > Livemark**.

## Usage

### Opening a file with Livemark

- **Open With... menu** -- with a Markdown file open in the default text editor, click the dropdown arrow next to the editor tab and select **Livemark**.
- **Explorer context menu** -- right-click a `.md` or `.markdown` file in the Explorer sidebar and choose **Open with Livemark**.
- **Command Palette** -- run `Open with Livemark` while a Markdown file URI is available.

### Toolbar

The toolbar at the top of the editor provides buttons for bold, italic, strikethrough, inline code, headings, lists, blockquotes, and code blocks. Hover over any button to see its tooltip and shortcut.

### Source mode

Press `Cmd+Shift+M` (macOS) or `Ctrl+Shift+M` (Windows/Linux) to toggle between the WYSIWYG view and raw Markdown source. You can also click the mode toggle button in the editor.

### Keyboard shortcuts

All shortcuts are active only when a Livemark editor is focused (`activeCustomEditorId == livemark.editor`).

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Toggle bold | `Cmd+B` | `Ctrl+B` |
| Toggle italic | `Cmd+I` | `Ctrl+I` |
| Heading 1 | `Cmd+1` | `Ctrl+1` |
| Heading 2 | `Cmd+2` | `Ctrl+2` |
| Heading 3 | `Cmd+3` | `Ctrl+3` |
| Toggle source/rendered mode | `Cmd+Shift+M` | `Ctrl+Shift+M` |

## Configuration

Settings are available under **Settings > Extensions > Livemark** or in `settings.json`:

| Setting | Default | Description |
| --- | --- | --- |
| `livemark.imageSaveFolder` | `"assets"` | Folder (relative to workspace root) where pasted/dropped images are saved. Supports `{mdfilepath}` to resolve to the markdown file's directory (e.g. `"{mdfilepath}/images"`). |
| `livemark.imageNamePattern` | `"image-{timestamp}"` | Naming pattern for saved images. Supports `{timestamp}`, `{hash}`, `{original}`, and `{mdfilename}` placeholders. |

**Example:**

```jsonc
{
  "livemark.imageSaveFolder": "img",
  "livemark.imageNamePattern": "{original}-{timestamp}"
}
```

### Setting Livemark as the default editor

By default, Livemark is available as an option editor (you must use **Open With...** to open Markdown files). To make Livemark the default editor for all `.md` files, add this to your VS Code settings:

```jsonc
{
  "workbench.editorAssociations": {
    "*.md": "livemark.editor"
  }
}
```

You can configure this in **Settings > Workbench > Editor Associations** or by adding it to your `settings.json` file directly. With this setting, all Markdown files will open in Livemark by default. You can still open any file with the standard text editor by right-clicking and choosing **Open With... > Text Editor**.

## Architecture overview

Livemark is split into two independently built layers that communicate through the VS Code webview message-passing API:

```
┌─────────────────────────────────┐
│  Extension Host (Node.js)       │
│  esbuild -> dist/extension.js   │
│                                 │
│  LivemarkEditorProvider          │
│   - CustomTextEditorProvider    │
│   - TextDocument = source of    │
│     truth for file contents     │
│   - ImageHandler, ThemeSync,    │
│     Commands                    │
└──────────┬──────────────────────┘
           │  typed messages
           │  (ExtensionMessage /
           │   WebviewMessage)
┌──────────▼──────────────────────┐
│  Webview (React 18 + TipTap)    │
│  Vite -> dist-webview/          │
│                                 │
│  App -> LivemarkEditor          │
│   - TipTap editor instance      │
│   - Toolbar, ModeToggle         │
│   - Serialization pipeline:     │
│     Markdown ↔ MDAST ↔ TipTap  │
│     (remark-parse, remark-gfm,  │
│      remark-frontmatter,        │
│      remark-stringify)          │
│   - ImagePaste extension        │
└─────────────────────────────────┘
```

The serialization pipeline is the core of the roundtrip fidelity:

1. **Markdown to TipTap** -- `markdownParser.ts` parses Markdown into an MDAST via remark/unified, then `mdastToTiptap.ts` converts the tree into TipTap-compatible JSON.
2. **TipTap to Markdown** -- `tiptapToMdast.ts` converts the TipTap JSON back to an MDAST, then `markdownSerializer.ts` stringifies it to Markdown via remark-stringify.

## Development

### Project structure

```
livemark/
├── src/                          # Extension (Node.js, TypeScript)
│   ├── extension.ts              # Entry point, activates provider + commands
│   ├── LivemarkEditorProvider.ts # CustomTextEditorProvider implementation
│   ├── commands.ts               # Formatting command registrations
│   ├── ImageHandler.ts           # Image save logic (base64 -> file)
│   ├── ThemeSync.ts              # VS Code theme detection + change events
│   ├── config.ts                 # Reads livemark.* settings
│   ├── messages.ts               # Typed message definitions
│   └── util.ts                   # Helpers (nonce generation, etc.)
├── webview-ui/                   # Webview (React + TipTap, TypeScript)
│   ├── src/
│   │   ├── main.tsx              # React DOM entry
│   │   ├── App.tsx               # Root component, messaging orchestration
│   │   ├── editor/
│   │   │   ├── LivemarkEditor.tsx          # TipTap editor wrapper
│   │   │   ├── extensions/
│   │   │   │   ├── ImagePaste.ts           # Clipboard/drag-drop image handling
│   │   │   │   └── index.ts               # Extension bundle
│   │   │   └── serialization/
│   │   │       ├── markdownParser.ts       # Markdown -> MDAST
│   │   │       ├── mdastToTiptap.ts        # MDAST -> TipTap JSON
│   │   │       ├── tiptapToMdast.ts        # TipTap JSON -> MDAST
│   │   │       └── markdownSerializer.ts   # MDAST -> Markdown
│   │   ├── components/
│   │   │   ├── Toolbar.tsx                 # Formatting toolbar
│   │   │   └── ModeToggle.tsx              # Source/rendered toggle
│   │   ├── hooks/
│   │   │   ├── useVSCodeMessaging.ts       # Message passing hook
│   │   │   ├── useEditorContent.ts         # Content sync hook
│   │   │   └── useTheme.ts                # Theme sync hook
│   │   ├── messages.ts                     # Webview-side message types
│   │   └── vscodeApi.ts                    # VS Code API wrapper
│   └── package.json
├── esbuild.mjs                   # Extension bundler config
├── tsconfig.json                 # Extension TypeScript config
└── package.json                  # Extension manifest + scripts
```

### Build commands

| Command | What it does |
| --- | --- |
| `npm run build` | Full build (webview then extension) |
| `npm run build:webview` | Build only the React/TipTap webview via Vite |
| `npm run build:extension` | Build only the extension via esbuild |
| `npm run watch:extension` | Watch mode for the extension (esbuild) |
| `npm run dev:webview` | Vite dev server for the webview (standalone) |
| `cd webview-ui && npx tsc --noEmit` | Type-check the webview without emitting |

### Development workflow

1. Run `npm run watch:extension` in one terminal for continuous extension rebuilds.
2. Run `npm run dev:webview` in another terminal if you want Vite HMR for iterating on the webview UI (note: full integration requires the built bundle in `dist-webview/`).
3. Press **F5** in VS Code to launch the Extension Development Host.
4. After changing webview code, run `npm run build:webview` and reload the webview (`Cmd+Shift+P` > **Developer: Reload Webviews**).

### Packaging and updating

To build and install an updated version of the extension:

```bash
# Build the code
npm run build

# Package into .vsix (updates version automatically via bump script)
npm run package -- --allow-missing-repository

# Install/update in VS Code
code --install-extension livemark-<version>.vsix --force
```

The `--force` flag ensures VS Code replaces any existing installation with the new version. After installation, reload VS Code to activate the changes.

**Note:** The `npm run build` command automatically bumps the patch version in `package.json` before building, so each build gets a new version number.

## License

MIT
