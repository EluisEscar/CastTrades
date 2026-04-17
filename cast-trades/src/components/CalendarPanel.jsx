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
          <div>
            <h2>Requests calendar</h2>
            <div className="sheet-lead">
              Review open shifts for the selected day and act without leaving the board.
            </div>
          </div>

          <button className="sheet-close sheet-close-danger" type="button" onClick={onClosePanel}>
            X
          </button>
        </div>

        <DateSheet
          label="Select day"
          title="Select date"
          value={calendarDate}
          onChange={setCalendarDate}
        />

        <div className="divider" />

        {loading ? (
          <div className="list">
            {[0, 1].map((index) => (
              <div key={index} className="list-card skeleton-card" aria-hidden="true" />
            ))}
          </div>
        ) : requestsForDay.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No requests for this day.</div>
            <div className="muted">Try another date or publish a new request.</div>
          </div>
        ) : (
          <div className="list">
            {requestsForDay.map((requestItem) => {
              const isMine = !!user?.id && requestItem.ownerId === user.id;

              return (
                <div key={requestItem.id} className="list-card">
                  <div className="list-row">
                    <div className="list-title">
                      {requestItem.location?.name || "Unknown location"}
                    </div>

                    <div className="list-right">
                      <span className="pill-mini">{requestItem.role}</span>
                      <span className="time-mini">
                        {requestItem.start}-{requestItem.end}
                      </span>
                    </div>
                  </div>

                  <div className="list-sub">{durationLabel(requestItem.start, requestItem.end)}</div>

                  <div className="action-row">
                    {!isMine ? (
                      <button
                        className="btn small accept"
                        type="button"
                        onClick={() => onAccept(requestItem)}
                      >
                        Accept
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn small edit"
                          type="button"
                          onClick={() => onEdit(requestItem)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn small danger"
                          type="button"
                          onClick={() => onDelete(requestItem)}
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
