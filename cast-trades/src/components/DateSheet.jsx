import React, { useRef, useState } from "react";
import BottomSheet from "./BottomSheet.jsx";
import { todayISO } from "../utils/dateUtils";

function pretty(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function DateSheetNative({
  label = "Fecha",
  title = "Select Date",
  value,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const minDate = todayISO(); 
  const openNativePicker = () => {
    const el = inputRef.current;
    if (!el) return;

    if (typeof el.showPicker === "function") el.showPicker();
    else {
      el.focus();
      el.click();
    }
  };

  return (
    <div>
      <div className="label">{label}</div>

      <button
        type="button"
        className="input sheet-trigger"
        onClick={() => {
          setOpen(true);
          setTimeout(openNativePicker, 80);
        }}
      >
        <span>{pretty(value) || "DD/MM/YYYY"}</span>
        <span className="chev">▾</span>
      </button>

      <BottomSheet open={open} title={title} onClose={() => setOpen(false)}>
        <div className="sheet-list" onClick={(e) => e.stopPropagation()}>
          <div className="label" style={{ marginBottom: 8 }}>
            Pick a date
          </div>

          <input
            ref={inputRef}
            className="input"
            type="date"
            value={value}
            min={minDate} 
            onChange={(e) => {
              const picked = e.target.value;
              if (picked && picked >= minDate) {
                onChange(picked);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />

          <button
            className="btn publish"
            type="button"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
