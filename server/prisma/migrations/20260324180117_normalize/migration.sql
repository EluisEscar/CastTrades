-- CreateEnum
CREATE TYPE "ShiftRequestStatus" AS ENUM ('OPEN', 'PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "pernerNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parkId" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_requests" (
    "id" TEXT NOT NULL,
    "status" "ShiftRequestStatus" NOT NULL DEFAULT 'OPEN',
    "role" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pendingAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "locationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,

    CONSTRAINT "shift_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_pernerNumber_key" ON "users"("pernerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "parks_name_key" ON "parks"("name");

-- CreateIndex
CREATE INDEX "locations_parkId_area_idx" ON "locations"("parkId", "area");

-- CreateIndex
CREATE UNIQUE INDEX "locations_parkId_area_name_key" ON "locations"("parkId", "area", "name");

-- CreateIndex
CREATE INDEX "shift_requests_locationId_date_status_idx" ON "shift_requests"("locationId", "date", "status");

-- CreateIndex
CREATE INDEX "shift_requests_ownerId_createdAt_idx" ON "shift_requests"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_requests_acceptedByUserId_createdAt_idx" ON "shift_requests"("acceptedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
