-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('SWAP', 'GIVEAWAY', 'PICKUP');

-- CreateEnum
CREATE TYPE "TradeRequestStatus" AS ENUM ('OPEN', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'RELEASED', 'SWAPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "pernerNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "park" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_requests" (
    "id" TEXT NOT NULL,
    "type" "TradeType" NOT NULL,
    "status" "TradeRequestStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,

    CONSTRAINT "trade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_offers" (
    "id" TEXT NOT NULL,
    "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tradeRequestId" TEXT NOT NULL,
    "offeredByUserId" TEXT NOT NULL,
    "offeredShiftId" TEXT,

    CONSTRAINT "trade_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_pernerNumber_key" ON "users"("pernerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_park_key" ON "locations"("name", "park");

-- CreateIndex
CREATE UNIQUE INDEX "positions_locationId_name_key" ON "positions"("locationId", "name");

-- CreateIndex
CREATE INDEX "shifts_locationId_startAt_idx" ON "shifts"("locationId", "startAt");

-- CreateIndex
CREATE INDEX "shifts_positionId_startAt_idx" ON "shifts"("positionId", "startAt");

-- CreateIndex
CREATE INDEX "shift_assignments_userId_createdAt_idx" ON "shift_assignments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_assignments_shiftId_createdAt_idx" ON "shift_assignments"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "trade_requests_status_createdAt_idx" ON "trade_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "trade_requests_requestedByUserId_createdAt_idx" ON "trade_requests"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "trade_offers_tradeRequestId_createdAt_idx" ON "trade_offers"("tradeRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "trade_offers_offeredByUserId_createdAt_idx" ON "trade_offers"("offeredByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_tradeRequestId_fkey" FOREIGN KEY ("tradeRequestId") REFERENCES "trade_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_offeredByUserId_fkey" FOREIGN KEY ("offeredByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_offeredShiftId_fkey" FOREIGN KEY ("offeredShiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
