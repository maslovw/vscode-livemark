import * as vscode from "vscode";

export function getImageSaveFolder(): string {
  return vscode.workspace
    .getConfiguration("livemark")
    .get<string>("imageSaveFolder", "assets");
}

export function getImageNamePattern(): string {
  return vscode.workspace
    .getConfiguration("livemark")
    .get<string>("imageNamePattern", "image-{timestamp}");
}

export function getConfirmImagePath(): boolean {
  return vscode.workspace
    .getConfiguration("livemark")
    .get<boolean>("confirmImagePath", false);
}
