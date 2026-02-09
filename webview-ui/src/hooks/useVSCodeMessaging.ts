import { useEffect, useCallback, useRef } from "react";
import { getVSCodeApi } from "../vscodeApi";
import type { ExtensionMessage, WebviewMessage } from "../messages";

type MessageHandler = (message: ExtensionMessage) => void;

export function useVSCodeMessaging(onMessage: MessageHandler) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      handlerRef.current(event.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const postMessage = useCallback((message: WebviewMessage) => {
    getVSCodeApi().postMessage(message);
  }, []);

  return { postMessage };
}
