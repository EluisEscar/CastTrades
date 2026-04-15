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

export async function getRequests({ parkId, area, date }, token) {
  const params = new URLSearchParams();

  if (parkId) params.set("parkId", parkId);
  if (area) params.set("area", area);
  if (date) params.set("date", date);

  const r = await fetch(`/requests?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponse(r, "Failed to fetch requests");
}

export async function createRequest(payload, token) {
  const r = await fetch("/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to create request");
}

export async function updateRequest(id, payload, token) {
  const r = await fetch(`/requests/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to update request");
}

export async function acceptRequest(id, token) {
  const r = await fetch(`/requests/${id}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponse(r, "Failed to accept request");
}

export async function deleteRequest(id, token) {
  const r = await fetch(`/requests/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponse(r, "Failed to delete request");
}