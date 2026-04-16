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
    startMinutes !== null && endMinutes !== null && endMinutes < startMinutes;

  const roleOptions = [{ value: "", label: "Select..." }, ...MERCH_ROLES];

  return (
    <div className="sheet-overlay" onClick={onClosePanel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div>
            <h2>{isEditing ? "Edit request" : "Create request"}</h2>
            <div className="sheet-lead">
              Build a clean shift request for {selectedLocation.name}.
            </div>
          </div>

          <button className="sheet-close" type="button" onClick={onClosePanel}>
            X
          </button>
        </div>

        <div className="metric-row">
          <div className="metric-card">
            <span className="metric-label">Location</span>
            <strong>{selectedLocation.name}</strong>
          </div>

          <div className="metric-card">
            <span className="metric-label">Mode</span>
            <strong>{isEditing ? "Editing" : "New request"}</strong>
          </div>
        </div>

        <form onSubmit={onCreateRequest}>
          <SheetSelect
            label="Role"
            title="Select role"
            value={role}
            options={roleOptions}
            onChange={setRole}
          />

          <div className="split-grid">
            <DateSheet
              label="Date"
              title="Select date"
              value={date}
              onChange={setDate}
            />

            <div>
              <div className="label">Start</div>
              <input
                className="input"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div>
              <div className="label">End</div>
              <input
                className="input"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {isOvernight ? <div className="hint">This shift ends on the next day.</div> : null}
          {formError ? <div className="form-error">{formError}</div> : null}

          <div className="action-row">
            <button className="btn publish" type="submit">
              {isEditing ? "Save changes" : "Publish request"}
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
