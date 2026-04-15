async function parseResponse(r, fallbackMessage) {
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const err = new Error(data.error || fallbackMessage);
    err.status = r.status;
    err.data = data;
    throw err;
  }

  return data;
}

let inboxPromise = null;
let inboxPromiseToken = null;

export async function getInbox(token) {
  if (inboxPromise && inboxPromiseToken === token) {
    return inboxPromise;
  }

  inboxPromiseToken = token;
  inboxPromise = fetch("/inbox", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((r) => parseResponse(r, "Failed to fetch inbox"))
    .finally(() => {
      inboxPromise = null;
      inboxPromiseToken = null;
    });

  return inboxPromise;
}

export async function ownerAcceptRequest(id, token) {
  const r = await fetch(`/requests/${id}/owner-accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponse(r, "Failed to approve request");
}

export async function ownerRejectRequest(id, payload, token) {
  const r = await fetch(`/requests/${id}/owner-reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to reject request");
}
