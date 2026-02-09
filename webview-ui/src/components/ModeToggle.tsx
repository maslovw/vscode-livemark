import React from "react";

interface ModeToggleProps {
  isSourceMode: boolean;
  onToggle: () => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  isSourceMode,
  onToggle,
}) => {
  return (
    <button
      className="livemark-mode-toggle"
      onClick={onToggle}
      title="Toggle Source/Rendered Mode (Cmd+Shift+M)"
    >
      {isSourceMode ? "Rendered" : "Source"}
    </button>
  );
};
