import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/vscode-theme.css";
import "./styles/editor.css";
import "./styles/typography.css";
import "./styles/syntax-highlight.css";
import "./styles/table.css";
import "./styles/image-caption.css";
import "./styles/toolbar.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
