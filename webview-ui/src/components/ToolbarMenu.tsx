import React, { useState, useRef, useEffect, useCallback } from "react";

interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

interface ToolbarMenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  title?: string;
}

export const ToolbarMenu: React.FC<ToolbarMenuProps> = ({
  trigger,
  items,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, updatePos]);

  return (
    <div className="livemark-toolbar-menu">
      <button
        ref={btnRef}
        className="livemark-toolbar-btn"
        onClick={() => setOpen((v) => !v)}
        title={title}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="livemark-toolbar-menu-dropdown"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              className={`livemark-toolbar-menu-item${item.danger ? " danger" : ""}`}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
