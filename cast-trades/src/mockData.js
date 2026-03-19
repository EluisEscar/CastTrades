export const parks = [
  { id: "animal_kingdom", name: "Animal Kingdom" },
];

export const areasByPark = {
  animal_kingdom: ["Merch"],
};

export const locations = [
  { id: "disney_trading_company", parkId: "animal_kingdom", area: "Merch", name: "Disney Trading Company" },
  { id: "island_mercantile", parkId: "animal_kingdom", area: "Merch", name: "Island Mercantile" },
  { id: "rivera_depot", parkId: "animal_kingdom", area: "Merch", name: "Rivera Depot" },
];

// Requests simulados (después esto viene de Firestore)
export const sampleRequests = [
  {
    id: "req1",
    parkId: "animal_kingdom",
    area: "Merch",
    locationId: "island_mercantile",
    locationName: "Island Mercantile",
    role: "Register",
    date: "2025-12-26",
    start: "14:00",
    end: "20:00",
    status: "OPEN",
    createdByName: "User A",
  },
  {
    id: "req2",
    parkId: "animal_kingdom",
    area: "Merch",
    locationId: "disney_trading_company",
    locationName: "Disney Trading Company",
    role: "Floorstock",
    date: "2025-12-27",
    start: "09:00",
    end: "15:00",
    status: "OPEN",
    createdByName: "User C",
  },
];

export const sampleNotifications = [
  {
    id: "n1",
    type: "PENDING_CONFIRMATION",
    message: "User B (perner ****1234) está esperando tu confirmación.",
    requestId: "req1",
    createdAt: "2025-12-24T10:10:00Z",
    read: false,
  },
];
