import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import BottomSheet from "../components/BottomSheet.jsx";

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

export default function Inbox() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("OTA");
  const [declineTarget, setDeclineTarget] = useState(null);

  const pendingForMe = useMemo(() => {
    if (!user?.uid) return [];
    const all = loadRequests();

    return all
      .filter((r) => r.ownerId === user.uid && r.status === "PENDING")
      .sort((a, b) => (b.pendingAt || "").localeCompare(a.pendingAt || ""));
  }, [user?.uid, refreshKey]);

  const declinedByMe = useMemo(() => {
    if (!user?.uid) return [];
    const all = loadRequests();

    return all
      .filter((r) => r.ownerId === user.uid && r.status === "DECLINED")
      .sort((a, b) => (b.declinedAt || "").localeCompare(a.declinedAt || ""));
  }, [user?.uid, refreshKey]);

  const updatesForMe = useMemo(() => {
    if (!user?.uid) return [];
    const all = loadRequests();

    return all
      .filter(
        (r) =>
          r.acceptedByUid === user.uid &&
          (r.status === "CONFIRMED" || r.status === "DECLINED")
      )
      .sort((a, b) => {
        const ta = b.confirmedAt || b.declinedAt || "";
        const tb = a.confirmedAt || a.declinedAt || "";
        return ta.localeCompare(tb);
      });
  }, [user?.uid, refreshKey]);

  const confirmDone = (req) => {
    const ok = confirm("Have you validated in Cast Life and want to confirm?");
    if (!ok) return;

    const all = loadRequests();
    const next = all.map((r) => {
      if (r.id !== req.id) return r;

      return {
        ...r,
        status: "CONFIRMED",
        confirmedAt: new Date().toISOString(),
      };
    });

    saveRequests(next);
    setRefreshKey((k) => k + 1);
  };

  const startDecline = (req) => {
    setDeclineTarget(req);
    setDeclineReason("OTA");
    setDeclineOpen(true);
  };

  const submitDecline = () => {
    if (!declineTarget) return;
    
    const rejectedUid = declineTarget.acceptedByUid;

    const all = loadRequests();
    const next = all.map((r) => {
      if (r.id !== declineTarget.id) return r;

      return {
        ...r,
        status: "DECLINED",
        declinedReason: declineReason,
        declinedAt: new Date().toISOString(),

        blockedAcceptors: Array.from(
          new Set([...(r.blockedAcceptors || []), rejectedUid].filter(Boolean))
        ),
      };
    });

    saveRequests(next);
    setDeclineOpen(false);
    setDeclineTarget(null);
    setRefreshKey((k) => k + 1);
  };

  const reopenRequest = (req) => {
    const ok = confirm("Re-open this request and make it available again?");
    if (!ok) return;

    const all = loadRequests();
    const next = all.map((r) => {
      if (r.id !== req.id) return r;

      return {
        ...r,
        status: "OPEN",

        // limpiar datos del aceptante anterior
        acceptedByUid: null,
        acceptedByName: null,
        acceptedByPerner: null,
        pendingAt: null,

        // ✅ (opcional) limpiar el decline visible, pero mantiene blockedAcceptors
        declinedReason: null,
        declinedAt: null,

        reopenedAt: new Date().toISOString(),
      };
    });

    saveRequests(next);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="page">
      <h1>Inbox</h1>

      <div className="card">
        <h2 className="section-title">Needs your confirmation</h2>

        {pendingForMe.length === 0 ? (
          <div className="muted">No pending confirmations.</div>
        ) : (
          <div className="list">
            {pendingForMe.map((r) => (
              <div key={r.id} className="list-card">
                <div className="list-title">{r.locationName}</div>

                <div className="list-sub">
                  {r.role} · {r.date} · {r.start}-{r.end}
                </div>

                <div className="divider" />

                <div className="list-sub">
                  <b>{r.acceptedByName || "A cast member"}</b> is waiting for your confirmation.
                </div>

                <div className="list-sub">
                  This is the perner number: <b>{r.acceptedByPerner || "N/A"}</b>
                </div>

                <div className="list-sub">
                  Please click <b>Accept</b> once you have validated the operation in Cast Life.
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <button className="btn small confirm" onClick={() => confirmDone(r)}>
                    Accept
                  </button>
                  <button
                    className="btn small danger"
                    onClick={() => startDecline(r)}
                    type="button"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="section-title">Declined by you</h2>

        {declinedByMe.length === 0 ? (
          <div className="muted">No declined requests.</div>
        ) : (
          <div className="list">
            {declinedByMe.map((r) => (
              <div key={r.id} className="list-card">
                <div className="list-title">{r.locationName}</div>
                <div className="list-sub">
                  {r.role} · {r.date} · {r.start}-{r.end}
                </div>

                <div className="divider" />

                <div className="list-sub">
                  Reason: <b>{r.declinedReason || "N/A"}</b>
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <button
                    className="btn small publish"
                    type="button"
                    onClick={() => reopenRequest(r)}
                  >
                    Re-open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="section-title">Updates</h2>

        {updatesForMe.length === 0 ? (
          <div className="muted">No updates yet.</div>
        ) : (
          <div className="list">
            {updatesForMe.map((r) => (
              <div key={r.id} className="list-card">
                <div className="list-title">{r.locationName}</div>
                <div className="list-sub">
                  {r.role} · {r.date} · {r.start}-{r.end}
                </div>

                <div className="divider" />

                {r.status === "CONFIRMED" ? (
                  <>
                    <div className="list-sub">
                      <b>Congratulations!</b> Your request was confirmed by the creator.
                    </div>
                    <div className="list-sub muted">
                      Please check Cast Life to make sure it went through.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="list-sub">
                      <b>Sorry,</b> the request couldn’t be processed.
                    </div>
                    <div className="list-sub">
                      Reason: <b>{r.declinedReason || "N/A"}</b>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet
        open={declineOpen}
        title="Why did you decline?"
        onClose={() => setDeclineOpen(false)}
      >
        <div className="sheet-list" onClick={(e) => e.stopPropagation()}>
          <div className="label" style={{ marginBottom: 8 }}>
            Select a reason
          </div>

          <button
            className={`sheet-item ${declineReason === "OTA" ? "active" : ""}`}
            type="button"
            onClick={() => setDeclineReason("OTA")}
          >
            OTA
          </button>

          <button
            className={`sheet-item ${declineReason === "Bad typing" ? "active" : ""}`}
            type="button"
            onClick={() => setDeclineReason("Bad typing")}
          >
            Bad typing
          </button>

          <button
            className={`sheet-item ${declineReason === "Other" ? "active" : ""}`}
            type="button"
            onClick={() => setDeclineReason("Other")}
          >
            Other
          </button>

          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <button
              className="btn small danger"
              type="button"
              onClick={() => setDeclineOpen(false)}
            >
              Cancel
            </button>
            <button className="btn small confirm" type="button" onClick={submitDecline}>
              Submit
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
