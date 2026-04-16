import React, { useRef, useState } from "react";
import BottomSheet from "./BottomSheet.jsx";
import { todayISO } from "../utils/dateUtils";

function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export default function DateSheet({
  label = "Date",
  title = "Select date",
  value,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const minDate = todayISO();

  const openNativePicker = () => {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div>
      <div className="label">{label}</div>

      <button
        type="button"
        className="input sheet-trigger"
        onClick={() => {
          setOpen(true);
          setTimeout(openNativePicker, 60);
        }}
      >
        <span>{formatDate(value) || "DD/MM/YYYY"}</span>
        <span className="chev">v</span>
      </button>

      <BottomSheet open={open} title={title} onClose={() => setOpen(false)}>
        <div className="sheet-list" onClick={(e) => e.stopPropagation()}>
          <div className="label">Pick a date</div>

          <input
            ref={inputRef}
            className="input"
            type="date"
            value={value}
            min={minDate}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (nextValue && nextValue >= minDate) {
                onChange(nextValue);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />

          <button className="btn publish" type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
