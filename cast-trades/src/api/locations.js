const locationsCache = new Map();
const locationsPromises = new Map();

export async function getLocations({ parkId, area }, token) {
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

  const request = fetch(`/locations?${cacheKey}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (r) => {
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data.error || "Failed to fetch locations");
      }

      locationsCache.set(cacheKey, data);
      return data;
    })
    .finally(() => {
      locationsPromises.delete(cacheKey);
    });

  locationsPromises.set(cacheKey, request);

  return request;
}
