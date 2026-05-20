import { apiFetch, parseResponse } from "./http.js";

function buildShiftPayload(payload) {
  return {
    ...payload,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  };
}

export async function getRequests({ parkId, area, date }) {
  const params = new URLSearchParams();

  if (parkId) params.set("parkId", parkId);
  if (area) params.set("area", area);
  if (date) params.set("date", date);

  const r = await apiFetch(`/requests?${params.toString()}`);

  return parseResponse(r, "Failed to fetch requests");
}

export async function createRequest(payload) {
  const r = await apiFetch("/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildShiftPayload(payload)),
  });

  return parseResponse(r, "Failed to create request");
}

export async function updateRequest(id, payload) {
  const r = await apiFetch(`/requests/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildShiftPayload(payload)),
  });

  return parseResponse(r, "Failed to update request");
}

export async function acceptRequest(id) {
  const r = await apiFetch(`/requests/${id}/accept`, {
    method: "POST",
  });

  return parseResponse(r, "Failed to accept request");
}

export async function deleteRequest(id) {
  const r = await apiFetch(`/requests/${id}`, {
    method: "DELETE",
  });

  return parseResponse(r, "Failed to delete request");
}
