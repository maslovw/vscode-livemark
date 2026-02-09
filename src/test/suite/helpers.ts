import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

/**
 * Directory for temporary test files. Created once, cleaned up after all tests.
 */
let tempDir: string | undefined;

/**
 * Returns the path to the test fixtures directory (the workspace opened by
 * the test runner).
 */
export function getFixturesPath(): string {
  return path.resolve(__dirname, "../../../src/test/fixtures");
}

/**
 * Returns a URI for a file inside the fixtures directory.
 */
export function fixtureUri(fileName: string): vscode.Uri {
  return vscode.Uri.file(path.join(getFixturesPath(), fileName));
}

/**
 * Creates a temporary directory that can be used for writing throwaway test
 * files. The same directory is reused for the duration of the test run.
 */
export function getTempDir(): string {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "livemark-test-"));
  }
  return tempDir;
}

/**
 * Creates a temporary markdown file with the given content and returns its URI.
 */
export function createTempMarkdownFile(
  content: string,
  fileName?: string
): vscode.Uri {
  const dir = getTempDir();
  const name = fileName ?? `test-${Date.now()}.md`;
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return vscode.Uri.file(filePath);
}

/**
 * Removes the temporary directory and all files within it.
 */
export function cleanupTempDir(): void {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
}

/**
 * Waits for the Livemark extension to be activated. Returns the extension
 * API export (if any).
 */
export async function waitForExtensionActivation(): Promise<
  vscode.Extension<unknown> | undefined
> {
  const ext = vscode.extensions.getExtension("livemark.livemark");
  if (!ext) {
    return undefined;
  }

  if (!ext.isActive) {
    await ext.activate();
  }
  return ext;
}

/**
 * Opens a document via the standard text editor and returns it.
 */
export async function openDocument(
  uri: vscode.Uri
): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  return doc;
}

/**
 * Opens a document with the Livemark custom editor and waits briefly for the
 * webview to initialise.
 */
export async function openWithLivemark(uri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "livemark.editor"
  );
  // Give the custom editor time to set up its webview
  await sleep(1500);
}

/**
 * Closes all open editors.
 */
export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
