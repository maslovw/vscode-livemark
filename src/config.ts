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

export type Alignment = "center" | "left";
export type WidthMode = "compact" | "wide" | "fit" | "resizable";

export function getAlignment(): Alignment {
  return vscode.workspace
    .getConfiguration("livemark")
    .get<Alignment>("alignment", "center");
}

export function getWidthMode(): WidthMode {
  return vscode.workspace
    .getConfiguration("livemark")
    .get<WidthMode>("width", "compact");
}

export function getContentWidth(): number {
  return vscode.workspace
    .getConfiguration("livemark")
    .get<number>("contentWidth", 800);
}
