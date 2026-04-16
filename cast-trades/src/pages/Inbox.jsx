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
  const timeRange = req?.start && req?.end ? `${req.start}-${req.end}` : "Unknown time";

  return `${locationName} | ${role} | ${timeRange}`;
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
  const locationName = notification?.shiftRequest?.location?.name || "this shift";

  switch (notification?.type) {
    case "REQUEST_ACCEPTED":
      return `Your request for ${locationName} was accepted. Verify it in CastLife.`;
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

function SectionBlock({ title, count, description, children }) {
  return (
    <section className="card stack-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <div className="muted">{description}</div>
        </div>

        <div className="count-pill">{count}</div>
      </div>

      {children}
    </section>
  );
}

export default function Inbox() {
  const { user } = useAuth();

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
    if (!user) return;

    try {
      setLoading(true);
      const data = await getInbox();

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
  }, [user]);

  useEffect(() => {
    fetchInboxData();
  }, [fetchInboxData]);

  const handleOwnerAccept = async (requestId) => {
    if (!user || !requestId) return;

    try {
      setActionId(requestId);
      await ownerAcceptRequest(requestId);
      setNeedsConfirmation((current) => removeNotificationByRequestId(current, requestId));
    } catch (err) {
      console.error("OWNER ACCEPT ERROR:", err);

      if (err.status === 409) {
        alert("This request was already updated or is no longer available.");
        setNeedsConfirmation((current) => removeNotificationByRequestId(current, requestId));
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
    if (!user || !rejectRequestId || !rejectReasonCode) return;

    try {
      setActionId(rejectRequestId);
      const currentItem = needsConfirmation.find(
        (item) => item.shiftRequest?.id === rejectRequestId
      );

      const result = await ownerRejectRequest(rejectRequestId, {
        reasonCode: rejectReasonCode,
        reopenShift,
      });

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
    return needsConfirmation.length + declinedByYou.length + updates.length;
  }, [needsConfirmation, declinedByYou, updates]);

  const summaryItems = [
    { label: "Needs action", value: needsConfirmation.length },
    { label: "Declined", value: declinedByYou.length },
    { label: "Updates", value: updates.length },
  ];

  return (
    <div className="page">
      <section className="hero-card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Inbox Control</div>
            <h1>Stay on top of approvals without digging through noise.</h1>
          </div>

          <button className="ghost-btn" type="button" onClick={fetchInboxData} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="metric-row">
          {summaryItems.map((item) => (
            <div key={item.label} className="metric-card">
              <span className="metric-label">{item.label}</span>
              <strong>{loading ? "..." : item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {!loading && totalItems === 0 && (
        <div className="empty-state">
          <div className="empty-title">Your inbox is clear.</div>
          <div className="muted">New approvals and outcomes will appear here.</div>
        </div>
      )}

      <SectionBlock
        title="Needs your confirmation"
        count={needsConfirmation.length}
        description="Approve only after the external CastLife step is complete."
      >
        {loading ? (
          <div className="list">
            {[0, 1].map((index) => (
              <div key={index} className="list-card skeleton-card" aria-hidden="true" />
            ))}
          </div>
        ) : needsConfirmation.length === 0 ? (
          <div className="muted">No pending confirmations.</div>
        ) : (
          <div className="list">
            {needsConfirmation.map((notification) => {
              const requestId = notification.shiftRequest?.id;
              const actorName = notification.actorUser?.firstName || "A cast member";
              const actorPerner = notification.actorUser?.pernerNumber || "N/A";

              return (
                <div key={notification.id} className="list-card">
                  <div className="list-row">
                    <div className="list-title">{actorName} wants your shift</div>
                    <div className="count-pill">PERNER {actorPerner}</div>
                  </div>

                  <div className="list-sub">{requestSummary(notification)}</div>
                  <div className="divider" />
                  <div className="muted">
                    Confirm only after the trade is completed in CastLife.
                  </div>

                  <div className="action-row">
                    <button
                      className="btn small confirm"
                      type="button"
                      disabled={!requestId || actionId === requestId}
                      onClick={() => handleOwnerAccept(requestId)}
                    >
                      {actionId === requestId ? "Processing..." : "Approve"}
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
      </SectionBlock>

      <SectionBlock
        title="Declined by you"
        count={declinedByYou.length}
        description="A short record of requests you already turned down."
      >
        {loading ? (
          <div className="list">
            <div className="list-card skeleton-card" aria-hidden="true" />
          </div>
        ) : declinedByYou.length === 0 ? (
          <div className="muted">No declined requests.</div>
        ) : (
          <div className="list">
            {declinedByYou.map((notification) => (
              <div key={notification.id} className="list-card">
                <div className="list-title">
                  {notification.actorUser?.firstName || "A cast member"}
                </div>
                <div className="list-sub">{requestSummary(notification)}</div>
                <div className="divider" />
                <div className="muted">
                  {formatRejectReason(notification.reasonCode) || "You declined this request."}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        title="Updates"
        count={updates.length}
        description="Accepted or rejected outcomes from your published requests."
      >
        {loading ? (
          <div className="list">
            <div className="list-card skeleton-card" aria-hidden="true" />
          </div>
        ) : updates.length === 0 ? (
          <div className="muted">No updates yet.</div>
        ) : (
          <div className="list">
            {updates.map((notification) => (
              <div key={notification.id} className="list-card">
                <div className="list-title">
                  {notification.shiftRequest?.location?.name || "Shift update"}
                </div>
                <div className="list-sub">{requestSummary(notification)}</div>
                <div className="divider" />
                <div className="muted">{formatUpdateMessage(notification)}</div>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>

      {rejectSheetOpen && (
        <div className="sheet-overlay" onClick={closeRejectSheet}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div className="sheet-header">
              <div>
                <h2>Reject request</h2>
                <div className="sheet-lead">Choose a reason and decide if the shift should reopen.</div>
              </div>

              <button className="sheet-close" type="button" onClick={closeRejectSheet}>
                X
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

            <div className="label">Reopen this shift?</div>
            <select
              className="input"
              value={reopenShift ? "YES" : "NO"}
              onChange={(e) => setReopenShift(e.target.value === "YES")}
            >
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>

            <div className="action-row">
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
