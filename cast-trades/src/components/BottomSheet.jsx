import React, { useEffect } from "react";

export default function BottomSheet({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div className="sheet-title">{title}</div>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="Close">
            X
          </button>
        </div>

        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
