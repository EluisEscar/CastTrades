import React from "react";
import SheetSelect from "./SheetSelect.jsx";
import DateSheet from "./DateSheet.jsx";
import { MERCH_ROLES } from "../mockData.js";

function timeToMinutes(time) {
  if (!time || !time.includes(":")) return null;

  const [hours, minutes] = time.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

export default function CreateRequestPanel({
  selectedLocation,
  role,
  setRole,
  date,
  setDate,
  start,
  setStart,
  end,
  setEnd,
  onCreateRequest,
  onClosePanel,
  formError,
  isEditing,
}) {
  if (!selectedLocation) return null;

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  const isOvernight =
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes < startMinutes;

  const roleOptions = [
    { value: "", label: "Select..." },
    ...MERCH_ROLES,
  ];

  return (
    <div className="sheet-overlay" onClick={onClosePanel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <h2>{isEditing ? "Edit Request" : "Create Request"}</h2>
          <button className="sheet-close" type="button" onClick={onClosePanel}>
            ✕
          </button>
        </div>

        <div className="label">Location</div>
        <div className="pill">{selectedLocation.name}</div>

        <form onSubmit={onCreateRequest}>
          <SheetSelect
            label="Role"
            title="Select Role"
            value={role}
            options={roleOptions}
            onChange={setRole}
          />

          <div className="row">
            <div style={{ flex: 1 }}>
              <DateSheet
                label="Date"
                title="Select Date"
                value={date}
                onChange={setDate}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div className="label">Start</div>
              <input
                className="input"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div className="label">End</div>
              <input
                className="input"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {isOvernight && (
            <div className="hint">This shift ends the next day.</div>
          )}

          {formError && <div className="form-error">{formError}</div>}

          <div className="row">
            <button className="btn publish" type="submit">
              {isEditing ? "Save Changes" : "Publish"}
            </button>

            <button className="btn" type="button" onClick={onClosePanel}>
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}