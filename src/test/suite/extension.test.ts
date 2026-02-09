import * as assert from "assert";
import * as vscode from "vscode";
import {
  fixtureUri,
  createTempMarkdownFile,
  cleanupTempDir,
  openDocument,
  openWithLivemark,
  closeAllEditors,
  sleep,
  waitForExtensionActivation,
} from "./helpers";

/**
 * All commands contributed by the Livemark extension.
 */
const EXPECTED_COMMANDS = [
  "livemark.toggleBold",
  "livemark.toggleItalic",
  "livemark.toggleStrikethrough",
  "livemark.toggleCode",
  "livemark.setHeading1",
  "livemark.setHeading2",
  "livemark.setHeading3",
  "livemark.toggleSourceMode",
  "livemark.openWithLivemark",
];

suite("Livemark Extension Integration Tests", () => {
  // ---------------------------------------------------------------
  // Setup / Teardown
  // ---------------------------------------------------------------

  suiteSetup(async () => {
    // Ensure the extension is activated before tests begin.
    // Opening a markdown file with the custom editor triggers activation.
    const uri = fixtureUri("sample.md");
    await openWithLivemark(uri);
    await closeAllEditors();
  });

  teardown(async () => {
    await closeAllEditors();
  });

  suiteTeardown(() => {
    cleanupTempDir();
  });

  // ---------------------------------------------------------------
  // 1. Extension activation
  // ---------------------------------------------------------------

  suite("Extension Activation", () => {
    test("extension is present in the extensions list", () => {
      const ext = vscode.extensions.getExtension("livemark.livemark");
      assert.ok(ext, "Livemark extension should be installed");
    });

    test("extension is activated", async () => {
      const ext = await waitForExtensionActivation();
      assert.ok(ext, "Livemark extension should exist");
      assert.strictEqual(ext!.isActive, true, "Extension should be active");
    });
  });

  // ---------------------------------------------------------------
  // 2. Command registration
  // ---------------------------------------------------------------

  suite("Command Registration", () => {
    let registeredCommands: string[];

    suiteSetup(async () => {
      registeredCommands = await vscode.commands.getCommands(true);
    });

    for (const cmd of EXPECTED_COMMANDS) {
      test(`command "${cmd}" is registered`, () => {
        assert.ok(
          registeredCommands.includes(cmd),
          `Command "${cmd}" should be registered`
        );
      });
    }
  });

  // ---------------------------------------------------------------
  // 3. Open markdown file with custom editor
  // ---------------------------------------------------------------

  suite("Custom Editor Opening", () => {
    test("opens a fixture .md file with the Livemark custom editor", async () => {
      const uri = fixtureUri("sample.md");
      await openWithLivemark(uri);

      // After opening with the custom editor, the active editor group should
      // have a tab. We verify by checking that no *text* editor is active
      // (custom editors do not expose a vscode.TextEditor).
      // The best we can assert is that the command did not throw.
      assert.ok(true, "vscode.openWith completed without error");
    });

    test("opens a temporary .md file with the custom editor", async () => {
      const uri = createTempMarkdownFile("# Temp\nSome temporary content.\n");
      await openWithLivemark(uri);
      assert.ok(true, "Temp file opened in custom editor without error");
    });

    test("opens an empty .md file with the custom editor", async () => {
      const uri = fixtureUri("empty.md");
      await openWithLivemark(uri);
      assert.ok(true, "Empty file opened in custom editor without error");
    });
  });

  // ---------------------------------------------------------------
  // 4. Document content
  // ---------------------------------------------------------------

  suite("Document Content", () => {
    test("document text matches file content for sample.md", async () => {
      const uri = fixtureUri("sample.md");
      const doc = await vscode.workspace.openTextDocument(uri);
      const text = doc.getText();

      assert.ok(
        text.includes("# Hello World"),
        "Document should contain the H1 heading"
      );
      assert.ok(
        text.includes("**sample**"),
        "Document should contain bold text"
      );
      assert.ok(
        text.includes("## Section Two"),
        "Document should contain the H2 heading"
      );
    });

    test("document text matches file content for formatting.md", async () => {
      const uri = fixtureUri("formatting.md");
      const doc = await vscode.workspace.openTextDocument(uri);
      const text = doc.getText();

      assert.ok(
        text.includes("**bold text**"),
        "Document should contain bold text"
      );
      assert.ok(
        text.includes("*italic text*"),
        "Document should contain italic text"
      );
      assert.ok(
        text.includes("~~strikethrough~~"),
        "Document should contain strikethrough text"
      );
      assert.ok(
        text.includes("`code span`"),
        "Document should contain code span"
      );
    });

    test("document for a temp file matches its created content", async () => {
      const content = "# Dynamic\n\nCreated during test.\n";
      const uri = createTempMarkdownFile(content, "dynamic-content.md");
      const doc = await vscode.workspace.openTextDocument(uri);

      assert.strictEqual(doc.getText(), content);
    });
  });

  // ---------------------------------------------------------------
  // 5. Edit document via WorkspaceEdit
  // ---------------------------------------------------------------

  suite("WorkspaceEdit Modifications", () => {
    test("inserting text at the beginning of the document", async () => {
      const original = "Some original content.\n";
      const uri = createTempMarkdownFile(original, "edit-insert.md");
      const doc = await vscode.workspace.openTextDocument(uri);

      const edit = new vscode.WorkspaceEdit();
      edit.insert(uri, new vscode.Position(0, 0), "# Inserted Heading\n\n");
      const applied = await vscode.workspace.applyEdit(edit);

      assert.strictEqual(applied, true, "WorkspaceEdit should be applied");
      assert.ok(
        doc.getText().startsWith("# Inserted Heading"),
        "Document should start with the inserted heading"
      );
      assert.ok(
        doc.getText().includes("Some original content."),
        "Original content should still be present"
      );
    });

    test("replacing the entire document content", async () => {
      const original = "Old content here.\n";
      const uri = createTempMarkdownFile(original, "edit-replace.md");
      const doc = await vscode.workspace.openTextDocument(uri);

      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        doc.positionAt(doc.getText().length)
      );

      const newContent = "# Completely New\n\nReplaced everything.\n";
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, newContent);
      const applied = await vscode.workspace.applyEdit(edit);

      assert.strictEqual(applied, true, "WorkspaceEdit should be applied");
      assert.strictEqual(doc.getText(), newContent);
    });

    test("deleting a range from the document", async () => {
      const original = "Line one\nLine two\nLine three\n";
      const uri = createTempMarkdownFile(original, "edit-delete.md");
      const doc = await vscode.workspace.openTextDocument(uri);

      // Delete "Line two\n"
      const edit = new vscode.WorkspaceEdit();
      edit.delete(
        uri,
        new vscode.Range(new vscode.Position(1, 0), new vscode.Position(2, 0))
      );
      const applied = await vscode.workspace.applyEdit(edit);

      assert.strictEqual(applied, true, "WorkspaceEdit should be applied");
      assert.strictEqual(doc.getText(), "Line one\nLine three\n");
    });
  });

  // ---------------------------------------------------------------
  // 6. Open with Livemark command
  // ---------------------------------------------------------------

  suite("livemark.openWithLivemark Command", () => {
    test("opens a markdown file via the openWithLivemark command", async () => {
      const uri = fixtureUri("sample.md");

      // The command accepts a URI argument and opens it in the custom editor
      await vscode.commands.executeCommand(
        "livemark.openWithLivemark",
        uri
      );
      // Allow time for the custom editor to open
      await sleep(1500);

      assert.ok(
        true,
        "livemark.openWithLivemark executed without throwing"
      );
    });

    test("opens a temporary file via the openWithLivemark command", async () => {
      const content = "# Via Command\n\nOpened via livemark.openWithLivemark.\n";
      const uri = createTempMarkdownFile(content, "via-command.md");

      await vscode.commands.executeCommand(
        "livemark.openWithLivemark",
        uri
      );
      await sleep(1500);

      // Verify the document is accessible
      const doc = await vscode.workspace.openTextDocument(uri);
      assert.ok(
        doc.getText().includes("# Via Command"),
        "Document should contain the expected heading"
      );
    });
  });

  // ---------------------------------------------------------------
  // 7. Custom editor provider registration
  // ---------------------------------------------------------------

  suite("Custom Editor Provider Registration", () => {
    test("livemark.editor viewType is usable for .md files", async () => {
      // If the custom editor provider were not registered, this would throw
      const uri = createTempMarkdownFile(
        "# Provider Check\n",
        "provider-check.md"
      );

      let didThrow = false;
      try {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "livemark.editor"
        );
        await sleep(1000);
      } catch {
        didThrow = true;
      }

      assert.strictEqual(
        didThrow,
        false,
        "Opening with livemark.editor viewType should not throw"
      );
    });

    test("livemark.editor viewType is usable for .markdown files", async () => {
      const dir = require("os").tmpdir();
      const fs = require("fs");
      const path = require("path");
      const tempDir2 = fs.mkdtempSync(path.join(dir, "livemark-md-ext-"));
      const filePath = path.join(tempDir2, "test.markdown");
      fs.writeFileSync(filePath, "# Markdown Extension\n", "utf-8");
      const uri = vscode.Uri.file(filePath);

      let didThrow = false;
      try {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "livemark.editor"
        );
        await sleep(1000);
      } catch {
        didThrow = true;
      }

      assert.strictEqual(
        didThrow,
        false,
        "Opening .markdown files with livemark.editor should not throw"
      );

      // Cleanup
      fs.rmSync(tempDir2, { recursive: true, force: true });
    });

    test("opening with an invalid viewType should fail", async () => {
      const uri = createTempMarkdownFile("# Bad ViewType\n", "bad-viewtype.md");

      let didThrow = false;
      try {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "nonexistent.viewType.12345"
        );
      } catch {
        didThrow = true;
      }

      assert.strictEqual(
        didThrow,
        true,
        "Opening with a non-existent viewType should throw"
      );
    });
  });

  // ---------------------------------------------------------------
  // 8. Formatting commands do not throw when no active webview
  // ---------------------------------------------------------------

  suite("Formatting Commands (no active webview)", () => {
    const formattingCommands = [
      "livemark.toggleBold",
      "livemark.toggleItalic",
      "livemark.toggleStrikethrough",
      "livemark.toggleCode",
      "livemark.setHeading1",
      "livemark.setHeading2",
      "livemark.setHeading3",
      "livemark.toggleSourceMode",
    ];

    for (const cmd of formattingCommands) {
      test(`"${cmd}" executes without throwing when no webview is active`, async () => {
        // Close all editors so there is no active webview
        await closeAllEditors();

        let didThrow = false;
        try {
          await vscode.commands.executeCommand(cmd);
        } catch {
          didThrow = true;
        }

        assert.strictEqual(
          didThrow,
          false,
          `${cmd} should not throw even without an active webview`
        );
      });
    }
  });

  // ---------------------------------------------------------------
  // 9. Multiple documents
  // ---------------------------------------------------------------

  suite("Multiple Documents", () => {
    test("can open multiple markdown files sequentially", async () => {
      const uri1 = createTempMarkdownFile("# First\n", "multi-1.md");
      const uri2 = createTempMarkdownFile("# Second\n", "multi-2.md");

      await openWithLivemark(uri1);
      await openWithLivemark(uri2);

      const doc1 = await vscode.workspace.openTextDocument(uri1);
      const doc2 = await vscode.workspace.openTextDocument(uri2);

      assert.ok(doc1.getText().includes("# First"), "First document intact");
      assert.ok(doc2.getText().includes("# Second"), "Second document intact");
    });
  });

  // ---------------------------------------------------------------
  // 10. Document lifecycle
  // ---------------------------------------------------------------

  suite("Document Lifecycle", () => {
    test("document is not dirty after opening", async () => {
      const uri = fixtureUri("sample.md");
      const doc = await vscode.workspace.openTextDocument(uri);

      assert.strictEqual(doc.isDirty, false, "Freshly opened doc should not be dirty");
    });

    test("document becomes dirty after a WorkspaceEdit", async () => {
      const uri = createTempMarkdownFile("Clean content.\n", "dirty-check.md");
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);

      const edit = new vscode.WorkspaceEdit();
      edit.insert(uri, new vscode.Position(0, 0), "Dirty! ");
      await vscode.workspace.applyEdit(edit);

      assert.strictEqual(doc.isDirty, true, "Document should be dirty after edit");
    });

    test("closing all editors works cleanly", async () => {
      const uri = createTempMarkdownFile("# Close Me\n", "close-test.md");
      await openWithLivemark(uri);
      await closeAllEditors();

      // After closing all editors, visibleTextEditors should be empty
      assert.strictEqual(
        vscode.window.visibleTextEditors.length,
        0,
        "No visible text editors after closing all"
      );
    });
  });
});
