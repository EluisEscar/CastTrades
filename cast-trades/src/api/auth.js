import { apiFetch, parseResponse } from "./http.js";

export async function register(payload) {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Register failed");
}

export async function login(email, password) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return parseResponse(r, "Login failed");
}

export async function logout() {
  const r = await apiFetch("/auth/logout", {
    method: "POST",
  });

  return parseResponse(r, "Logout failed");
}

export async function getCurrentUser() {
  const r = await apiFetch("/me");
  return parseResponse(r, "Failed to load session");
}

export async function updateCurrentUser(payload) {
  const r = await apiFetch("/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(r, "Failed to update profile");
}
