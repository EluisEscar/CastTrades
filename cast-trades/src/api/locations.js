import { apiFetch, parseResponse } from "./http.js";

const locationsCache = new Map();
const locationsPromises = new Map();

export function invalidateLocationsCache() {
  locationsCache.clear();
  locationsPromises.clear();
}

export async function getLocations({ parkId, area }) {
  const params = new URLSearchParams();

  if (parkId) params.set("parkId", parkId);
  if (area) params.set("area", area);

  const cacheKey = params.toString();

  if (locationsCache.has(cacheKey)) {
    return locationsCache.get(cacheKey);
  }

  if (locationsPromises.has(cacheKey)) {
    return locationsPromises.get(cacheKey);
  }

  const request = apiFetch(`/locations?${cacheKey}`)
    .then((r) => parseResponse(r, "Failed to fetch locations"))
    .then((data) => {
      locationsCache.set(cacheKey, data);
      return data;
    })
    .finally(() => {
      locationsPromises.delete(cacheKey);
    });

  locationsPromises.set(cacheKey, request);

  return request;
}
