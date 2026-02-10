import React, { useState, useRef, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Generic small inline dialog used for Link / Image URL input       */
/* ------------------------------------------------------------------ */

export interface InlineDialogField {
  /** Unique key used as state key */
  key: string;
  /** Placeholder / label */
  label: string;
  /** Pre-filled value */
  defaultValue?: string;
}

interface InlineDialogProps {
  /** Title shown at the top */
  title: string;
  fields: InlineDialogField[];
  /** Label on the submit button */
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export const InlineDialog: React.FC<InlineDialogProps> = ({
  title,
  fields,
  submitLabel = "OK",
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = f.defaultValue ?? "";
    }
    return init;
  });

  const firstInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Auto-focus the first field when the dialog opens
    firstInput.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit(values);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="livemark-inline-dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="livemark-inline-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="livemark-inline-dialog-title">{title}</div>
        {fields.map((f, i) => (
          <input
            key={f.key}
            ref={i === 0 ? firstInput : undefined}
            className="livemark-inline-dialog-input"
            placeholder={f.label}
            value={values[f.key]}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
            }
          />
        ))}
        <div className="livemark-inline-dialog-actions">
          <button
            className="livemark-inline-dialog-btn primary"
            onClick={() => onSubmit(values)}
          >
            {submitLabel}
          </button>
          <button
            className="livemark-inline-dialog-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
