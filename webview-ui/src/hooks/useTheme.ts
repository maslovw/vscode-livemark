import { useCallback } from "react";

export type ThemeKind = "light" | "dark" | "high-contrast";

export function useTheme() {
  const applyTheme = useCallback((theme: ThemeKind) => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return { applyTheme };
}
