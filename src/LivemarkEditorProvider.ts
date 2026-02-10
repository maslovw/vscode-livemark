import * as vscode from "vscode";
import * as path from "path";
import { getNonce } from "./util";
import { getCurrentTheme, onThemeChange } from "./ThemeSync";
import { saveImage, deleteImageFromDisk, generateImagePath, saveImageWithPath } from "./ImageHandler";
import { setActiveWebview } from "./commands";
import type { ExtensionMessage, WebviewMessage } from "./messages";
import { getConfirmImagePath, getAlignment, getWidthMode, getContentWidth } from "./config";

export class LivemarkEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static readonly viewType = "livemark.editor";

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(
    context: vscode.ExtensionContext
  ): vscode.Disposable {
    const provider = new LivemarkEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      LivemarkEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const webview = webviewPanel.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist-webview"),
        // Allow loading images from workspace
        ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
      ],
    };

    webview.html = this.getHtmlForWebview(webview);

    // Track if we should suppress external change events (stays true for the full applyEdit lifecycle)
    let suppressExternalChanges = false;
    let suppressLayoutChange = false;

    // Post typed message helper
    const postMessage = (message: ExtensionMessage): boolean => {
      return webview.postMessage(message) as unknown as boolean;
    };

    // Set active webview for commands
    setActiveWebview(postMessage);

    // Handle messages from webview
    const messageDisposable = webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case "webview:ready": {
            const docDirUri = vscode.Uri.file(
              path.dirname(document.uri.fsPath)
            );
            const extVersion = this.context.extension.packageJSON.version ?? "";
            postMessage({
              type: "ext:init",
              text: document.getText(),
              theme: getCurrentTheme(),
              baseUri: webview.asWebviewUri(docDirUri).toString(),
              version: extVersion,
              alignment: getAlignment(),
              width: getWidthMode(),
              contentWidth: getContentWidth(),
            });
            break;
          }
          case "webview:contentChanged": {
            suppressExternalChanges = true;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              new vscode.Range(0, 0, document.lineCount, 0),
              message.text
            );
            await vscode.workspace.applyEdit(edit);
            suppressExternalChanges = false;
            break;
          }
          case "webview:pasteImage": {
            try {
              let relativePath: string;
              
              if (getConfirmImagePath()) {
                // Generate proposed path and show input dialog
                const proposedPath = generateImagePath(
                  document.uri,
                  message.fileName
                );
                const userPath = await vscode.window.showInputBox({
                  prompt: "Enter path and filename for the pasted image",
                  value: proposedPath,
                  validateInput: (value) => {
                    if (!value || value.trim() === "") {
                      return "Path cannot be empty";
                    }
                    return null;
                  },
                });
                
                if (!userPath) {
                  // User cancelled
                  break;
                }
                
                relativePath = await saveImageWithPath(
                  document.uri,
                  message.base64,
                  userPath
                );
              } else {
                // Save directly with default path
                relativePath = await saveImage(
                  document.uri,
                  message.base64,
                  message.fileName
                );
              }
              
              postMessage({
                type: "ext:imageSaved",
                relativePath,
              });
            } catch (err) {
              vscode.window.showErrorMessage(
                `Failed to save image: ${err}`
              );
            }
            break;
          }
          case "webview:deleteImage": {
            const answer = await vscode.window.showInformationMessage(
              `Delete image file "${message.imagePath}" from disk?`,
              { modal: true },
              "Delete from Disk"
            );
            if (answer === "Delete from Disk") {
              try {
                await deleteImageFromDisk(
                  document.uri,
                  message.imagePath
                );
              } catch (err) {
                vscode.window.showWarningMessage(
                  `Could not delete image: ${err}`
                );
              }
            }
            break;
          }          case "webview:openImage": {
            const docDir = path.dirname(document.uri.fsPath);
            const imagePath = path.resolve(docDir, message.imagePath);
            const imageUri = vscode.Uri.file(imagePath);
            try {
              await vscode.commands.executeCommand(
                "vscode.open",
                imageUri,
                { preview: false }
              );
            } catch (err) {
              vscode.window.showWarningMessage(
                `Could not open image: ${message.imagePath}`
              );
            }
            break;
          }          case "webview:openLink": {
            const href = message.href;
            if (
              href.startsWith("http://") ||
              href.startsWith("https://")
            ) {
              vscode.env.openExternal(vscode.Uri.parse(href));
            } else {
              // Local file link
              const docDir = path.dirname(document.uri.fsPath);
              const targetPath = path.resolve(docDir, href);
              const targetUri = vscode.Uri.file(targetPath);
              try {
                await vscode.commands.executeCommand(
                  "vscode.open",
                  targetUri
                );
              } catch {
                vscode.window.showWarningMessage(
                  `Could not open: ${href}`
                );
              }
            }
            break;
          }
          case "webview:setLayout": {
            suppressLayoutChange = true;
            const config = vscode.workspace.getConfiguration("livemark");
            if (message.alignment) {
              await config.update("alignment", message.alignment, vscode.ConfigurationTarget.Global);
            }
            if (message.width) {
              await config.update("width", message.width, vscode.ConfigurationTarget.Global);
            }
            if (message.contentWidth !== undefined) {
              await config.update("contentWidth", message.contentWidth, vscode.ConfigurationTarget.Global);
            }
            setTimeout(() => { suppressLayoutChange = false; }, 200);
            break;
          }
        }
      }
    );

    // Handle external document changes
    const changeDisposable =
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() !== document.uri.toString()) return;
        if (e.contentChanges.length === 0) return;

        if (suppressExternalChanges) {
          return;
        }

        postMessage({
          type: "ext:documentChanged",
          text: document.getText(),
        });
      });

    // Handle theme changes
    const themeDisposable = onThemeChange((theme) => {
      postMessage({
        type: "ext:themeChanged",
        theme,
      });
    });

    // Handle layout config changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("livemark.alignment") ||
        e.affectsConfiguration("livemark.width") ||
        e.affectsConfiguration("livemark.contentWidth")
      ) {
        if (suppressLayoutChange) return;
        postMessage({
          type: "ext:layoutChanged",
          alignment: getAlignment(),
          width: getWidthMode(),
          contentWidth: getContentWidth(),
        });
      }
    });

    // Track active panel for commands
    const visibilityDisposable = webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        setActiveWebview(postMessage);
      }
    });

    // Cleanup
    webviewPanel.onDidDispose(() => {
      setActiveWebview(null);
      messageDisposable.dispose();
      changeDisposable.dispose();
      themeDisposable.dispose();
      visibilityDisposable.dispose();
      configDisposable.dispose();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    const distUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist-webview"
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, "assets", "index.css")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Livemark</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
