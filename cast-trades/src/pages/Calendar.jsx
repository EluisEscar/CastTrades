import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { sampleRequests } from "../mockData.js";
import { todayISO } from "../utils/dateUtils";
import DateSheet from "../components/DateSheet.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function loadRequests() {
  try {
    return JSON.parse(localStorage.getItem("casttrades_requests") || "[]");
  } catch {
    return [];
  }
}

function saveRequests(next) {
  localStorage.setItem("casttrades_requests", JSON.stringify(next));
}

function minutesFromHHMM(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function durationLabel(start, end) {
  let diff = minutesFromHHMM(end) - minutesFromHHMM(start);
  if (diff < 0) diff += 24 * 60;

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  if (mins === 0) return `${hrs} hrs`;
  return `${hrs} hrs ${mins} min`;
}

export default function Calendar() {
  const { user } = useAuth();

  const q = useQuery();
  const parkId = q.get("park") || "animal_kingdom";
  const area = q.get("area") || "Merch";

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [refreshKey, setRefreshKey] = useState(0);

  const requestsForDay = useMemo(() => {
    const stored = loadRequests();
    const all = [...sampleRequests, ...stored];

    // ✅ Calendar SOLO muestra OPEN
    return all.filter((r) => {
      const sameDay =
        r.parkId === parkId && r.area === area && r.date === selectedDate;
      const isOpen = !r.status || r.status === "OPEN";
      return sameDay && isOpen;
    });
  }, [parkId, area, selectedDate, refreshKey]);

  const onAccept = (req) => {
    if (!user?.uid) return;

    // No auto-accept
    if (req.ownerId === user.uid) return;

    // Solo aceptar si está OPEN
    const isOpen = !req.status || req.status === "OPEN";
    if (!isOpen) return;

    // ✅ bloqueado? no puede aceptar
    const blocked = (req.blockedAcceptors || []).includes(user.uid);
    if (blocked) {
      alert("You can’t accept this request again.");
      return;
    }

    // Solo se actualiza lo guardado en localStorage
    const stored = loadRequests();

    const next = stored.map((r) => {
      if (r.id !== req.id) return r;

      return {
        ...r,
        status: "PENDING",
        acceptedByUid: user.uid,
        acceptedByName: `${(user?.name ?? "USER").toUpperCase()} ${
          user?.lastName ? user.lastName.charAt(0).toUpperCase() : ""
        }`,
        acceptedByPerner: user?.pernerNumber ?? "",
        pendingAt: new Date().toISOString(),
      };
    });

    saveRequests(next);
    setRefreshKey((k) => k + 1);

    alert("Request accepted. Waiting for creator confirmation in Inbox.");
  };

  const onDelete = (req) => {
    if (!user?.uid) return;
    if (req.ownerId !== user.uid) return;

    const ok = confirm("Delete this request?");
    if (!ok) return;

    const stored = loadRequests();
    const next = stored.filter((r) => r.id !== req.id);
    saveRequests(next);

    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="page">
      <h1>Calendar</h1>

      <div className="card">
        <DateSheet
          label="Selecciona día"
          title="Select Date"
          value={selectedDate}
          onChange={setSelectedDate}
        />

        <div className="divider" />

        {requestsForDay.length === 0 ? (
          <div className="muted">No requests available for this day.</div>
        ) : (
          <div className="list">
            {requestsForDay.map((r) => {
              const isMine = !!user?.uid && r.ownerId === user.uid;

              const isBlocked = !!user?.uid && (r.blockedAcceptors || []).includes(user.uid);

              return (
                <div key={r.id} className="list-card">
                  <div className="list-row">
                    <div className="list-title">{r.locationName}</div>

                    <div className="list-right">
                      <span className="pill-mini">{r.role}</span>
                      <span className="time-mini">
                        {r.start}-{r.end}
                      </span>
                    </div>
                  </div>

                  <div className="list-sub">{durationLabel(r.start, r.end)}</div>

                  <div className="row" style={{ gap: 10 }}>
                    {/* ✅ Accept SOLO si NO es mío y NO estoy bloqueado */}
                    {!isMine && !isBlocked ? (
                      <button className="btn small accept" onClick={() => onAccept(r)}>
                        Accept
                      </button>
                    ) : null}

                    {isMine ? (
                      <button
                        className="btn small danger"
                        type="button"
                        onClick={() => onDelete(r)}
                      >
                        Delete
                      </button>
                    ) : null}
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
