-- Create enums
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'ACTIVATE', 'DEACTIVATE', 'CANCEL', 'REOPEN', 'ROLE_CHANGE');
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'PARK', 'LOCATION', 'REQUEST');

-- Alter users
ALTER TABLE "users"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Alter parks
ALTER TABLE "parks"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Create audit logs
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" "AuditEntityType" NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
