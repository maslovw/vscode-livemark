import * as vscode from "vscode";
import { LivemarkEditorProvider } from "./LivemarkEditorProvider";
import { registerCommands } from "./commands";

export function activate(context: vscode.ExtensionContext): void {
  // Register the custom editor provider
  context.subscriptions.push(LivemarkEditorProvider.register(context));

  // Register formatting commands
  context.subscriptions.push(...registerCommands(context));
}

export function deactivate(): void {
  // Nothing to clean up
}
