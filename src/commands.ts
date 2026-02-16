import * as vscode from "vscode";
import type { ExecuteCommandMessage, RequestHtmlExportMessage } from "./messages";
import { exportAsHtml } from "./htmlExporter";

type PostMessageFn = (message: ExecuteCommandMessage | RequestHtmlExportMessage) => boolean;

const COMMANDS = [
  "livemark.toggleBold",
  "livemark.toggleItalic",
  "livemark.toggleStrikethrough",
  "livemark.toggleCode",
  "livemark.setHeading1",
  "livemark.setHeading2",
  "livemark.setHeading3",
  "livemark.setHeading4",
  "livemark.setHeading5",
  "livemark.setHeading6",
  "livemark.increaseHeadingLevel",
  "livemark.decreaseHeadingLevel",
  "livemark.toggleSourceMode",
] as const;

const COMMAND_MAP: Record<string, string> = {
  "livemark.toggleBold": "toggleBold",
  "livemark.toggleItalic": "toggleItalic",
  "livemark.toggleStrikethrough": "toggleStrike",
  "livemark.toggleCode": "toggleCode",
  "livemark.setHeading1": "setHeading1",
  "livemark.setHeading2": "setHeading2",
  "livemark.setHeading3": "setHeading3",
  "livemark.setHeading4": "setHeading4",
  "livemark.setHeading5": "setHeading5",
  "livemark.setHeading6": "setHeading6",
  "livemark.increaseHeadingLevel": "increaseHeadingLevel",
  "livemark.decreaseHeadingLevel": "decreaseHeadingLevel",
  "livemark.toggleSourceMode": "toggleSourceMode",
};

let activePostMessage: PostMessageFn | null = null;
let pendingHtmlExportResolve: ((result: { html: string; json?: string }) => void) | null = null;

export function setActiveWebview(postMessage: PostMessageFn | null): void {
  activePostMessage = postMessage;
}

export function handleHtmlExport(html: string, json?: string): void {
  if (pendingHtmlExportResolve) {
    pendingHtmlExportResolve({ html, json });
    pendingHtmlExportResolve = null;
  }
}

async function requestHtmlFromWebview(timeoutMs: number = 5000): Promise<{ html: string; json?: string } | null> {
  if (!activePostMessage) {
    return null;
  }

  return new Promise<{ html: string; json?: string } | null>((resolve) => {
    const timeout = setTimeout(() => {
      pendingHtmlExportResolve = null;
      resolve(null);
    }, timeoutMs);

    pendingHtmlExportResolve = (result: { html: string; json?: string }) => {
      clearTimeout(timeout);
      resolve(result);
    };

    activePostMessage({
      type: "ext:requestHtmlExport",
    });
  });
}

export function registerCommands(
  context: vscode.ExtensionContext
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  for (const cmd of COMMANDS) {
    disposables.push(
      vscode.commands.registerCommand(cmd, () => {
        const mapped = COMMAND_MAP[cmd];
        if (activePostMessage && mapped) {
          activePostMessage({
            type: "ext:executeCommand",
            command: mapped,
          });
        }
      })
    );
  }

  // Open with Livemark command
  disposables.push(
    vscode.commands.registerCommand(
      "livemark.openWithLivemark",
      async (uri?: vscode.Uri) => {
        if (uri) {
          await vscode.commands.executeCommand(
            "vscode.openWith",
            uri,
            "livemark.editor"
          );
        }
      }
    )
  );

  // Export as HTML command
  disposables.push(
    vscode.commands.registerCommand(
      "livemark.exportAsHtml",
      async () => {
        // Try to get document from active text editor first
        let document = vscode.window.activeTextEditor?.document;
        let isLivemarkEditor = false;
        
        // If not available, try to get from active tab (for custom editors)
        if (!document) {
          const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
          if (activeTab?.input instanceof vscode.TabInputText) {
            document = await vscode.workspace.openTextDocument(activeTab.input.uri);
          } else if (activeTab?.input instanceof vscode.TabInputCustom) {
            document = await vscode.workspace.openTextDocument(activeTab.input.uri);
            isLivemarkEditor = true;
          }
        }
        
        if (!document) {
          vscode.window.showErrorMessage("No active markdown file to export");
          return;
        }
        
        // Check if it's a markdown file
        if (document.languageId !== 'markdown') {
          vscode.window.showErrorMessage("Active file is not a markdown document");
          return;
        }

        // If we're in the Livemark editor, try to get rendered HTML
        let renderedHtml: string | undefined;
        let editorJson: string | undefined;
        if (isLivemarkEditor && activePostMessage) {
          const result = await requestHtmlFromWebview();
          if (result) {
            renderedHtml = result.html;
            editorJson = result.json;
          }
        }

        await exportAsHtml(document, renderedHtml, editorJson);
      }
    )
  );

  return disposables;
}
