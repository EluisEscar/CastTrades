const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

function resolveApiUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!API_BASE_URL) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

async function readJson(r) {
  const contentType = r.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {};
  }

  return r.json().catch(() => ({}));
}

export async function parseResponse(r, fallbackMessage) {
  const data = await readJson(r);

  if (!r.ok) {
    const err = new Error(data.error || fallbackMessage);
    err.status = r.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function apiFetch(url, options = {}) {
  return fetch(resolveApiUrl(url), {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
}
