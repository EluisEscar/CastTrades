import React, { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet.jsx";

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

export default function SheetSelect({
  label,
  value,
  options,
  onChange,
  title = "Select",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  const currentLabel = useMemo(() => {
    const currentOption = options.find((option) => option.value === value);
    return currentOption ? currentOption.label : "Select...";
  }, [options, value]);

  const handleOpen = () => {
    if (disabled) return;
    haptic();
    setOpen(true);
  };

  return (
    <div>
      {label ? <div className="label">{label}</div> : null}

      <button
        type="button"
        className={`input sheet-trigger ${disabled ? "disabled" : ""}`}
        onClick={handleOpen}
        disabled={disabled}
      >
        <span>{currentLabel}</span>
        <span className="chev">v</span>
      </button>

      <BottomSheet open={open} title={title} onClose={() => setOpen(false)}>
        <div className="sheet-list">
          {options.map((option) => {
            const active = option.value === value;
            const isOptionDisabled = !!option.disabled;

            return (
              <button
                key={option.value}
                type="button"
                className={`sheet-item ${active ? "active" : ""} ${isOptionDisabled ? "disabled" : ""}`}
                onClick={() => {
                  if (isOptionDisabled) return;
                  haptic();
                  onChange(option.value);
                  setOpen(false);
                }}
                disabled={isOptionDisabled}
              >
                <div className="sheet-item-label">{option.label}</div>
                {active ? <div className="sheet-check">OK</div> : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
