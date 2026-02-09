import * as vscode from "vscode";
import type { ExecuteCommandMessage } from "./messages";

type PostMessageFn = (message: ExecuteCommandMessage) => boolean;

const COMMANDS = [
  "livemark.toggleBold",
  "livemark.toggleItalic",
  "livemark.toggleStrikethrough",
  "livemark.toggleCode",
  "livemark.setHeading1",
  "livemark.setHeading2",
  "livemark.setHeading3",
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
  "livemark.toggleSourceMode": "toggleSourceMode",
};

let activePostMessage: PostMessageFn | null = null;

export function setActiveWebview(postMessage: PostMessageFn | null): void {
  activePostMessage = postMessage;
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

  return disposables;
}
