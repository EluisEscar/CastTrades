import { apiFetch, parseResponse, resolveApiUrl } from "./http.js";

let inboxPromise = null;
let inboxCache = null;
let inboxGeneration = 0;
const subscribers = new Set();

let eventSource = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
const MAX_RECONNECT_DELAY_MS = 30_000;

function notifySubscribers(data) {
  for (const cb of subscribers) {
    try {
      cb(data);
    } catch {
      // ignore subscriber errors
    }
  }
}

function requestInbox() {
  const requestGeneration = inboxGeneration;

  inboxPromise = apiFetch("/inbox")
    .then((r) => parseResponse(r, "Failed to fetch inbox"))
    .then((data) => {
      if (requestGeneration === inboxGeneration) {
        inboxCache = data;
        notifySubscribers(data);
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

export function subscribeToInbox(cb) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (eventSource !== null) {
      openEventStream();
    }
  }, delay);
}

function openEventStream() {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return;
  }

  closeEventStreamInternal();

  const source = new EventSource(resolveApiUrl("/events"), {
    withCredentials: true,
  });
  eventSource = source;

  source.onopen = () => {
    reconnectAttempt = 0;
  };

  source.addEventListener("inbox-changed", () => {
    getInbox({ force: true }).catch(() => {});
  });

  source.onerror = () => {
    source.close();
    if (eventSource === source) {
      scheduleReconnect();
    }
  };
}

function closeEventStreamInternal() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function startInboxStream() {
  reconnectAttempt = 0;
  openEventStream();
}

export function stopInboxStream() {
  eventSource = null;
  closeEventStreamInternal();
}

export async function ownerAcceptRequest(id) {
  clearInboxCache();
  const r = await apiFetch(`/requests/${id}/owner-accept`, {
    method: "POST",
  });

  return parseResponse(r, "Failed to approve request");
}

export async function ownerRejectRequest(id, payload) {
  clearInboxCache();
  const r = await apiFetch(`/requests/${id}/owner-reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to reject request");
}
