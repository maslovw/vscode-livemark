import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/vscode-theme.css";
import "./styles/editor.css";
import "./styles/typography.css";
import "./styles/syntax-highlight.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
