let parksCache = null;
let parksPromise = null;

export async function getParks(token) {
  if (parksCache) {
    return parksCache;
  }

  if (parksPromise) {
    return parksPromise;
  }

  parksPromise = fetch("/parks", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (r) => {
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data.error || "Failed to fetch parks");
      }

      parksCache = data;
      return data;
    })
    .finally(() => {
      parksPromise = null;
    });

  return parksPromise;
}
