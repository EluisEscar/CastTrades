/*
  Warnings:

  - Added the required column `startsAt` to the `shift_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "shift_requests" ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL;
