import React, { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet.jsx";

const haptic = () => {
  if (navigator.vibrate) navigator.vibrate(10);
};

export default function SheetSelect({
  label,
  value,
  options,
  onChange,
  title = "Select",
}) {
  const [open, setOpen] = useState(false);

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found ? found.label : "Select…";
  }, [options, value]);

  return (
    <div>
      {label ? <div className="label">{label}</div> : null}

      <button
        type="button"
        className="input sheet-trigger"
        onClick={() => {
          haptic();
          setOpen(true);
        }}
      >
        <span>{currentLabel}</span>
        <span className="chev">▾</span>
      </button>

      <BottomSheet
        open={open}
        title={title}
        onClose={() => setOpen(false)}
      >
        <div className="sheet-list">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={`sheet-item ${active ? "active" : ""}`}
                onClick={() => {
                  haptic();
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <div className="sheet-item-label">{o.label}</div>
                {active ? <div className="sheet-check">✓</div> : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
