import { apiFetch, parseResponse } from "./http.js";

let parksCache = null;
let parksPromise = null;

export function invalidateParksCache() {
  parksCache = null;
  parksPromise = null;
}

export async function getParks() {
  if (parksCache) {
    return parksCache;
  }

  if (parksPromise) {
    return parksPromise;
  }

  parksPromise = apiFetch("/parks")
    .then((r) => parseResponse(r, "Failed to fetch parks"))
    .then((data) => {
      parksCache = data;
      return data;
    })
    .finally(() => {
      parksPromise = null;
    });

  return parksPromise;
}
