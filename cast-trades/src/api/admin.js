import { apiFetch, parseResponse } from "./http.js";

function buildQuery(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getAdminOverview() {
  const r = await apiFetch("/admin/overview");
  return parseResponse(r, "Failed to load admin overview");
}

export async function getAdminUsers(params) {
  const r = await apiFetch(`/admin/users${buildQuery(params)}`);
  return parseResponse(r, "Failed to load users");
}

export async function updateAdminUser(id, payload) {
  const r = await apiFetch(`/admin/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to update user");
}

export async function getAdminParks() {
  const r = await apiFetch("/admin/parks");
  return parseResponse(r, "Failed to load parks");
}

export async function createAdminPark(payload) {
  const r = await apiFetch("/admin/parks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to create park");
}

export async function updateAdminPark(id, payload) {
  const r = await apiFetch(`/admin/parks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to update park");
}

export async function getAdminLocations(params) {
  const r = await apiFetch(`/admin/locations${buildQuery(params)}`);
  return parseResponse(r, "Failed to load locations");
}

export async function createAdminLocation(payload) {
  const r = await apiFetch("/admin/locations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to create location");
}

export async function updateAdminLocation(id, payload) {
  const r = await apiFetch(`/admin/locations/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to update location");
}

export async function getAdminRequests(params) {
  const r = await apiFetch(`/admin/requests${buildQuery(params)}`);
  return parseResponse(r, "Failed to load requests");
}

export async function updateAdminRequest(id, payload) {
  const r = await apiFetch(`/admin/requests/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to update request");
}

export async function getAdminAuditLogs(params) {
  const r = await apiFetch(`/admin/audit-logs${buildQuery(params)}`);
  return parseResponse(r, "Failed to load audit logs");
}
