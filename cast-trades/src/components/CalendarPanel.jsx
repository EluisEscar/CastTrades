import React from "react";
import DateSheet from "./DateSheet.jsx";

export default function CalendarPanel({
  calendarDate,
  setCalendarDate,
  requestsForDay,
  loading,
  user,
  durationLabel,
  onAccept,
  onDelete,
  onEdit,
  onClosePanel,
}) {
  return (
    <div className="sheet-overlay" onClick={onClosePanel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <h2>Requests Calendar</h2>
          <button className="sheet-close" type="button" onClick={onClosePanel}>
            ✕
          </button>
        </div>

        <DateSheet
          label="Select day"
          title="Select Date"
          value={calendarDate}
          onChange={setCalendarDate}
        />

        <div className="divider" />

        {loading ? (
          <div className="muted">Loading...</div>
        ) : requestsForDay.length === 0 ? (
          <div className="muted">No requests available for this day.</div>
        ) : (
          <div className="list">
            {requestsForDay.map((r) => {
              const isMine = !!user?.id && r.ownerId === user.id;

              return (
                <div key={r.id} className="list-card">
                  <div className="list-row">
                    <div className="list-title">
                      {r.location?.name || "Unknown location"}
                    </div>

                    <div className="list-right">
                      <span className="pill-mini">{r.role}</span>
                      <span className="time-mini">
                        {r.start}-{r.end}
                      </span>
                    </div>
                  </div>

                  <div className="list-sub">
                    {durationLabel(r.start, r.end)}
                  </div>

                  <div className="row" style={{ gap: 10 }}>
                    {!isMine && (
                      <button
                        className="btn small accept"
                        type="button"
                        onClick={() => onAccept(r)}
                      >
                        Accept
                      </button>
                    )}

                    {isMine && (
                      <>
                        <button
                          className="btn small edit"
                          type="button"
                          onClick={() => onEdit(r)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn small danger"
                          type="button"
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
