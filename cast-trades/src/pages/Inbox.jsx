import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  getInbox,
  ownerAcceptRequest,
  ownerRejectRequest,
} from "../api/inbox.js";

const DECLINED_BY_YOU_LIMIT = 20;

function requestSummary(notification) {
  const req = notification?.shiftRequest;
  const locationName = req?.location?.name || "Unknown location";
  const role = req?.role || "Unknown role";
  const timeRange =
    req?.start && req?.end ? `${req.start}-${req.end}` : "Unknown time";

  return `${locationName} • ${role} • ${timeRange}`;
}

function formatRejectReason(reasonCode) {
  switch (reasonCode) {
    case "OVERTIME_LIMIT":
      return "Reason: Overtime limit";
    case "INCORRECT_PERNER":
      return "Reason: Incorrect PERNER";
    case "OTHER":
      return "Reason: Other";
    default:
      return "";
  }
}

function formatUpdateMessage(notification) {
  const locationName =
    notification?.shiftRequest?.location?.name || "this shift";

  switch (notification?.type) {
    case "REQUEST_ACCEPTED":
      return `Your request for ${locationName} was accepted. Please verify it in CastLife.`;
    case "REQUEST_REJECTED":
      return `Your request for ${locationName} was declined. ${formatRejectReason(
        notification?.reasonCode
      )}`.trim();
    default:
      return "No update available.";
  }
}

function isValidNotificationItem(item) {
  return item && item.id;
}

function removeNotificationByRequestId(items, requestId) {
  return items.filter((item) => item.shiftRequest?.id !== requestId);
}

function createDeclinedNotification(item, reasonCode, shiftRequest) {
  return {
    ...item,
    id: `local-declined-${item.id}-${Date.now()}`,
    type: "DECLINED_BY_YOU",
    reasonCode,
    shiftRequest: {
      ...item.shiftRequest,
      ...shiftRequest,
      location: shiftRequest?.location || item.shiftRequest?.location,
    },
  };
}

export default function Inbox() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [needsConfirmation, setNeedsConfirmation] = useState([]);
  const [declinedByYou, setDeclinedByYou] = useState([]);
  const [updates, setUpdates] = useState([]);

  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState(null);
  const [rejectReasonCode, setRejectReasonCode] = useState("");
  const [reopenShift, setReopenShift] = useState(true);

  const fetchInboxData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await getInbox(token);

      setNeedsConfirmation((data?.needsConfirmation || []).filter(isValidNotificationItem));
      setDeclinedByYou((data?.declinedByYou || []).filter(isValidNotificationItem));
      setUpdates((data?.updates || []).filter(isValidNotificationItem));
    } catch (err) {
      console.error("FETCH INBOX ERROR:", err);
      setNeedsConfirmation([]);
      setDeclinedByYou([]);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInboxData();
  }, [fetchInboxData]);

  const handleOwnerAccept = async (requestId) => {
    if (!token || !requestId) return;

    try {
      setActionId(requestId);
      await ownerAcceptRequest(requestId, token);
      setNeedsConfirmation((current) =>
        removeNotificationByRequestId(current, requestId)
      );
    } catch (err) {
      console.error("OWNER ACCEPT ERROR:", err);

      if (err.status === 409) {
        alert("This request was already updated or is no longer available.");
        setNeedsConfirmation((current) =>
          removeNotificationByRequestId(current, requestId)
        );
        return;
      }

      alert(err.message || "Failed to approve request.");
    } finally {
      setActionId(null);
    }
  };

  const openRejectSheet = (requestId) => {
    setRejectRequestId(requestId);
    setRejectReasonCode("");
    setReopenShift(true);
    setRejectSheetOpen(true);
  };

  const closeRejectSheet = () => {
    setRejectSheetOpen(false);
    setRejectRequestId(null);
    setRejectReasonCode("");
    setReopenShift(true);
  };

  const handleConfirmReject = async () => {
    if (!token || !rejectRequestId || !rejectReasonCode) return;

    try {
      setActionId(rejectRequestId);
      const currentItem = needsConfirmation.find(
        (item) => item.shiftRequest?.id === rejectRequestId
      );

      const result = await ownerRejectRequest(
        rejectRequestId,
        {
          reasonCode: rejectReasonCode,
          reopenShift,
        },
        token
      );

      setNeedsConfirmation((current) =>
        removeNotificationByRequestId(current, rejectRequestId)
      );

      if (currentItem) {
        setDeclinedByYou((current) => [
          createDeclinedNotification(currentItem, rejectReasonCode, result),
          ...current,
        ].slice(0, DECLINED_BY_YOU_LIMIT));
      }

      closeRejectSheet();
    } catch (err) {
      console.error("OWNER REJECT ERROR:", err);

      if (err.status === 409) {
        closeRejectSheet();
        alert("This request was already updated or is no longer available.");
        setNeedsConfirmation((current) =>
          removeNotificationByRequestId(current, rejectRequestId)
        );
        return;
      }

      alert(err.message || "Failed to reject request.");
    } finally {
      setActionId(null);
    }
  };

  const totalItems = useMemo(() => {
    return (
      needsConfirmation.length +
      declinedByYou.length +
      updates.length
    );
  }, [needsConfirmation, declinedByYou, updates]);

  return (
    <div className="page">
      <h1>Inbox</h1>

      {!loading && totalItems === 0 && (
        <div className="card">
          <div className="muted">Your inbox is empty.</div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Needs your confirmation</h2>

        {loading ? (
          <div className="muted">Loading...</div>
        ) : needsConfirmation.length === 0 ? (
          <div className="muted">No pending confirmations.</div>
        ) : (
          <div className="list">
            {needsConfirmation.map((n) => {
              const requestId = n.shiftRequest?.id;
              const actorName = n.actorUser?.firstName || "A cast member";
              const actorPerner = n.actorUser?.pernerNumber || "N/A";

              return (
                <div key={n.id} className="list-card">
                  <div className="list-title">{actorName} wants your shift</div>

                  <div className="list-sub">
                    PERNER: <b>{actorPerner}</b>
                  </div>

                  <div className="list-sub">{requestSummary(n)}</div>

                  <div className="divider" />

                  <div className="list-sub">
                    Please confirm after you complete the process in CastLife.
                  </div>

                  <div className="row" style={{ gap: 10 }}>
                    <button
                      className="btn small confirm"
                      type="button"
                      disabled={!requestId || actionId === requestId}
                      onClick={() => handleOwnerAccept(requestId)}
                    >
                      {actionId === requestId ? "Processing..." : "Accept"}
                    </button>

                    <button
                      className="btn small danger"
                      type="button"
                      disabled={!requestId || actionId === requestId}
                      onClick={() => openRejectSheet(requestId)}
                    >
                      {actionId === requestId ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="section-title">Declined by you</h2>

        {loading ? (
          <div className="muted">Loading...</div>
        ) : declinedByYou.length === 0 ? (
          <div className="muted">No declined requests.</div>
        ) : (
          <div className="list">
            {declinedByYou.map((n) => (
              <div key={n.id} className="list-card">
                <div className="list-title">
                  {n.actorUser?.firstName || "A cast member"}
                </div>

                <div className="list-sub">{requestSummary(n)}</div>

                <div className="divider" />

                <div className="list-sub">
                  {formatRejectReason(n.reasonCode) || "You declined this request."}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="section-title">Updates</h2>

        {loading ? (
          <div className="muted">Loading...</div>
        ) : updates.length === 0 ? (
          <div className="muted">No updates yet.</div>
        ) : (
          <div className="list">
            {updates.map((n) => (
              <div key={n.id} className="list-card">
                <div className="list-title">
                  {n.shiftRequest?.location?.name || "Shift update"}
                </div>

                <div className="list-sub">{requestSummary(n)}</div>

                <div className="divider" />

                <div className="list-sub">{formatUpdateMessage(n)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectSheetOpen && (
        <div className="sheet-overlay" onClick={closeRejectSheet}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div className="sheet-header">
              <h2>Select an option</h2>
              <button
                className="sheet-close"
                type="button"
                onClick={closeRejectSheet}
              >
                ✕
              </button>
            </div>

            <div className="label">Reason</div>
            <select
              className="input"
              value={rejectReasonCode}
              onChange={(e) => setRejectReasonCode(e.target.value)}
            >
              <option value="">Select an option</option>
              <option value="OVERTIME_LIMIT">Overtime limit</option>
              <option value="INCORRECT_PERNER">Incorrect PERNER</option>
              <option value="OTHER">Other</option>
            </select>

            <div className="label" style={{ marginTop: 12 }}>
              Reopen this shift?
            </div>
            <select
              className="input"
              value={reopenShift ? "YES" : "NO"}
              onChange={(e) => setReopenShift(e.target.value === "YES")}
            >
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>

            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <button
                className="btn small danger"
                type="button"
                disabled={!rejectReasonCode || actionId === rejectRequestId}
                onClick={handleConfirmReject}
              >
                {actionId === rejectRequestId ? "Processing..." : "Confirm reject"}
              </button>

              <button className="btn small" type="button" onClick={closeRejectSheet}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
