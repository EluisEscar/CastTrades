/*
  Warnings:

  - You are about to drop the column `message` on the `notifications` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RejectReason" AS ENUM ('OVERTIME_LIMIT', 'INCORRECT_PERNER', 'OTHER');

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "message",
ADD COLUMN     "reasonCode" "RejectReason",
ADD COLUMN     "reasonText" TEXT;
