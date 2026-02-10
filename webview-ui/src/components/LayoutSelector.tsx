import React from "react";

interface LayoutSelectorProps {
  alignment: string;
  width: string;
  onAlignmentChange: (alignment: string) => void;
  onWidthChange: (width: string) => void;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({
  alignment,
  width,
  onAlignmentChange,
  onWidthChange,
}) => {
  return (
    <>
      <select
        className="livemark-toolbar-select livemark-layout-select"
        value={alignment}
        onChange={(e) => onAlignmentChange(e.target.value)}
        title="Content Alignment"
      >
        <option value="center">Center</option>
        <option value="left">Left</option>
      </select>
      <select
        className="livemark-toolbar-select livemark-layout-select"
        value={width}
        onChange={(e) => onWidthChange(e.target.value)}
        title="Content Width"
      >
        <option value="compact">Compact (800px)</option>
        <option value="wide">Wide (1200px)</option>
        <option value="fit">Fit Window</option>
        <option value="resizable">Resizable</option>
      </select>
    </>
  );
};
