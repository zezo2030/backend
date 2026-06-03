-- Publish listings that were waiting for admin review (approval flow removed).
UPDATE "properties"
SET "moderationStatus" = 'active'::"ModerationStatus",
    "rejectionReason" = NULL
WHERE "moderationStatus" = 'pending_review'::"ModerationStatus"
  AND "deletedAt" IS NULL;
