import { apiFetch, parseResponse, resolveApiUrl } from "./http.js";

let inboxPromise = null;
let inboxCache = null;
let inboxGeneration = 0;

function requestInbox() {
  const requestGeneration = inboxGeneration;

  inboxPromise = apiFetch("/inbox")
    .then((r) => parseResponse(r, "Failed to fetch inbox"))
    .then((data) => {
      if (requestGeneration === inboxGeneration) {
        inboxCache = data;
      }

      return data;
    })
    .finally(() => {
      inboxPromise = null;
    });

  return inboxPromise;
}

export async function getInbox(options = {}) {
  const { force = false } = options;

  if (force) {
    inboxCache = null;
  }

  if (!force && inboxCache) {
    return inboxCache;
  }

  if (inboxPromise) {
    return inboxPromise;
  }

  return requestInbox();
}

export function prefetchInbox() {
  if (inboxCache) {
    return Promise.resolve(inboxCache);
  }

  if (inboxPromise) {
    return inboxPromise;
  }

  return requestInbox();
}

export function clearInboxCache() {
  inboxGeneration += 1;
  inboxCache = null;
  inboxPromise = null;
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
