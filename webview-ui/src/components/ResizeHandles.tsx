import React, { useState, useCallback, useEffect, useRef } from "react";

interface ResizeHandlesProps {
  contentWidth: number;
  onWidthChange: (width: number) => void;
  onResizeEnd: (width: number) => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  contentWidth,
  onWidthChange,
  onResizeEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragSide = useRef<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const currentWidth = useRef(contentWidth);

  useEffect(() => {
    currentWidth.current = contentWidth;
  }, [contentWidth]);

  const handleMouseDown = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragSide.current = side;
      startX.current = e.clientX;
      startWidth.current = contentWidth;
      setIsDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [contentWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragSide.current) return;
      const dx = e.clientX - startX.current;
      // Multiply by 2 because content is centered (both sides move)
      const delta = dragSide.current === "right" ? dx * 2 : -dx * 2;
      const newWidth = Math.max(400, Math.min(2400, startWidth.current + delta));
      currentWidth.current = newWidth;
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      dragSide.current = null;
      setIsDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      onResizeEnd(currentWidth.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, onWidthChange, onResizeEnd]);

  const handleClass = `livemark-resize-handle${isDragging ? " dragging" : ""}`;

  return (
    <>
      <div
        className={`${handleClass} left`}
        onMouseDown={handleMouseDown("left")}
        title="Drag to resize content width"
      />
      <div
        className={`${handleClass} right`}
        onMouseDown={handleMouseDown("right")}
        title="Drag to resize content width"
      />
    </>
  );
};
