-- Reintroduce the admin review workflow + per-listing contact overrides.

-- AlterTable: per-listing contact overrides + pending-by-default for new listings.
ALTER TABLE "properties" ADD COLUMN "contactName" TEXT;
ALTER TABLE "properties" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "properties" ALTER COLUMN "moderationStatus" SET DEFAULT 'pending_review';

-- AlterTable: add the moderation gate + contact overrides to property requests.
ALTER TABLE "property_requests" ADD COLUMN "contactName" TEXT;
ALTER TABLE "property_requests" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "property_requests" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "property_requests" ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'pending_review';

-- Data migration: keep every currently-live request visible. New rows default to
-- pending_review; only pre-existing (non-deleted) rows are auto-published.
UPDATE "property_requests"
SET "moderationStatus" = 'active'::"ModerationStatus"
WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "property_requests_review_feed_idx" ON "property_requests" ("deletedAt", "moderationStatus", "status", "createdAt" DESC);
CREATE INDEX "property_requests_moderationStatus_createdAt_idx" ON "property_requests" ("moderationStatus", "createdAt" DESC);
