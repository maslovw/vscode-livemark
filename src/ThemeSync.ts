import * as vscode from "vscode";

export type ThemeKind = "light" | "dark" | "high-contrast";

export function getCurrentTheme(): ThemeKind {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
    case vscode.ColorThemeKind.HighContrastLight:
      return "light";
    case vscode.ColorThemeKind.Dark:
      return "dark";
    case vscode.ColorThemeKind.HighContrast:
      return "high-contrast";
    default:
      return "dark";
  }
}

export function onThemeChange(
  callback: (theme: ThemeKind) => void
): vscode.Disposable {
  return vscode.window.onDidChangeActiveColorTheme(() => {
    callback(getCurrentTheme());
  });
}
