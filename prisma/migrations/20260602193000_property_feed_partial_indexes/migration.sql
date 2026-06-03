-- Partial indexes for the public property feed (Supabase Postgres best practice:
-- index only the row subset that queries always filter on).
--
-- Matches PropertiesQueryService.buildFeedWhere():
--   deletedAt IS NULL
--   moderationStatus = 'active'
--   ownerIsActive = true
--   availabilityStatus IN ('available', 'reserved')
-- ORDER BY createdAt DESC, id DESC

CREATE INDEX "properties_feed_active_createdAt_idx"
ON "properties" ("createdAt" DESC, "id" DESC)
WHERE "deletedAt" IS NULL
  AND "moderationStatus" = 'active'::"ModerationStatus"
  AND "ownerIsActive" = true
  AND "availabilityStatus" IN ('available'::"AvailabilityStatus", 'reserved'::"AvailabilityStatus");

CREATE INDEX "properties_feed_active_filter_idx"
ON "properties" ("cityId", "areaId", "propertyType", "listingType", "price", "createdAt" DESC, "id" DESC)
WHERE "deletedAt" IS NULL
  AND "moderationStatus" = 'active'::"ModerationStatus"
  AND "ownerIsActive" = true
  AND "availabilityStatus" IN ('available'::"AvailabilityStatus", 'reserved'::"AvailabilityStatus");
