// Message types shared between extension and webview

export interface InitMessage {
  type: "ext:init";
  text: string;
  theme: "light" | "dark" | "high-contrast";
  baseUri: string;
}

export interface DocumentChangedMessage {
  type: "ext:documentChanged";
  text: string;
}

export interface ThemeChangedMessage {
  type: "ext:themeChanged";
  theme: "light" | "dark" | "high-contrast";
}

export interface ImageSavedMessage {
  type: "ext:imageSaved";
  relativePath: string;
}

export interface ExecuteCommandMessage {
  type: "ext:executeCommand";
  command: string;
}

export type ExtensionMessage =
  | InitMessage
  | DocumentChangedMessage
  | ThemeChangedMessage
  | ImageSavedMessage
  | ExecuteCommandMessage;

export interface WebviewReadyMessage {
  type: "webview:ready";
}

export interface ContentChangedMessage {
  type: "webview:contentChanged";
  text: string;
}

export interface PasteImageMessage {
  type: "webview:pasteImage";
  base64: string;
  fileName: string;
}

export interface OpenLinkMessage {
  type: "webview:openLink";
  href: string;
}

export type WebviewMessage =
  | WebviewReadyMessage
  | ContentChangedMessage
  | PasteImageMessage
  | OpenLinkMessage;
