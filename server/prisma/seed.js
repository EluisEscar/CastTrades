import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // =========================
  // PARKS
  // =========================
  const parks = [
    { id: "animal_kingdom", name: "Animal Kingdom" }
    /*
    { id: "disney_springs", name: "Disney Springs" },
    { id: "epcot", name: "EPCOT" },
    { id: "hollywood_studios", name: "Hollywood Studios" },
    { id: "magic_kingdom", name: "Magic Kingdom" }
     */
  ];

  for (const park of parks) {
    await prisma.park.upsert({
      where: { id: park.id },
      update: {},
      create: park,
    });
  }

  console.log("✅ Parks seeded");

  // =========================
  // LOCATIONS
  // =========================
  const locations = [
    // ANIMAL KINGDOM
    {
      id: "discovery_trading_company",
      name: "Discovery Trading Company",
      parkId: "animal_kingdom",
      area: "Merch",
    },
    {
      id: "island_mercantile",
      name: "Island Mercantile",
      parkId: "animal_kingdom",
      area: "Merch",
    },
    {
      id: "africa_mombasa",
      name: "Africa",
      parkId: "animal_kingdom",
      area: "Merch",
    }
    /*
    // EPCOT
    {
      id: "creations_shop",
      name: "Creations Shop",
      parkId: "epcot",
      area: "Merch",
    },
    {
      id: "gateway_gifts",
      name: "Gateway Gifts",
      parkId: "epcot",
      area: "Merch",
    },

    // HOLLYWOOD STUDIOS
    {
      id: "celebrity_5_and_10",
      name: "Celebrity 5 & 10",
      parkId: "hollywood_studios",
      area: "Merch",
    },
    {
      id: "tatooine_traders",
      name: "Tatooine Traders",
      parkId: "hollywood_studios",
      area: "Merch",
    },

    // MAGIC KINGDOM
    {
      id: "emporium",
      name: "Emporium",
      parkId: "magic_kingdom",
      area: "Merch",
    },
    {
      id: "big_top_souvenirs",
      name: "Big Top Souvenirs",
      parkId: "magic_kingdom",
      area: "Merch",
    },
    */
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { id: loc.id },
      update: {},
      create: loc,
    });
  }

  console.log("✅ Locations seeded");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });