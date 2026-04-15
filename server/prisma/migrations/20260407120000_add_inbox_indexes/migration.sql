CREATE INDEX "notifications_userId_type_createdAt_idx"
ON "notifications"("userId", "type", "createdAt");

CREATE INDEX "notifications_userId_type_readAt_createdAt_idx"
ON "notifications"("userId", "type", "readAt", "createdAt");
