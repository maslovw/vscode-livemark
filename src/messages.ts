// Message types shared between extension and webview

export interface InitMessage {
  type: "ext:init";
  text: string;
  theme: "light" | "dark" | "high-contrast" | "high-contrast-light";
  baseUri: string;
  version: string;
  alignment: string;
  width: string;
  contentWidth: number;
  toolbarContextMode: string;
  showLayoutControls: boolean;
  plantumlServer: string;
}

export interface DocumentChangedMessage {
  type: "ext:documentChanged";
  text: string;
}

export interface ThemeChangedMessage {
  type: "ext:themeChanged";
  theme: "light" | "dark" | "high-contrast" | "high-contrast-light";
}

export interface ImageSavedMessage {
  type: "ext:imageSaved";
  relativePath: string;
}

export interface ExecuteCommandMessage {
  type: "ext:executeCommand";
  command: string;
}

export interface LayoutChangedMessage {
  type: "ext:layoutChanged";
  alignment: string;
  width: string;
  contentWidth: number;
  toolbarContextMode: string;
  showLayoutControls: boolean;
}

export type ExtensionMessage =
  | InitMessage
  | DocumentChangedMessage
  | ThemeChangedMessage
  | ImageSavedMessage
  | ExecuteCommandMessage
  | LayoutChangedMessage;

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

export interface DeleteImageMessage {
  type: "webview:deleteImage";
  imagePath: string;
}

export interface OpenImageMessage {
  type: "webview:openImage";
  imagePath: string;
}

export interface SetLayoutMessage {
  type: "webview:setLayout";
  alignment?: string;
  width?: string;
  contentWidth?: number;
}

export type WebviewMessage =
  | WebviewReadyMessage
  | ContentChangedMessage
  | PasteImageMessage
  | OpenLinkMessage
  | DeleteImageMessage
  | OpenImageMessage
  | SetLayoutMessage;
