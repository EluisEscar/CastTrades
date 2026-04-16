import { apiFetch, parseResponse } from "./http.js";

let inboxPromise = null;

export async function getInbox() {
  if (inboxPromise) {
    return inboxPromise;
  }

  inboxPromise = apiFetch("/inbox")
    .then((r) => parseResponse(r, "Failed to fetch inbox"))
    .finally(() => {
      inboxPromise = null;
    });

  return inboxPromise;
}

export async function ownerAcceptRequest(id) {
  const r = await apiFetch(`/requests/${id}/owner-accept`, {
    method: "POST",
  });

  return parseResponse(r, "Failed to approve request");
}

export async function ownerRejectRequest(id, payload) {
  const r = await apiFetch(`/requests/${id}/owner-reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to reject request");
}
