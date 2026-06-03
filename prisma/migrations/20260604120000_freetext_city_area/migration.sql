-- City and area become free-text columns instead of Location foreign keys.
-- (Broker fan-out is location-agnostic; feed filters match on stored text.)

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_areaId_fkey";
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_cityId_fkey";
ALTER TABLE "property_requests" DROP CONSTRAINT IF EXISTS "property_requests_areaId_fkey";
ALTER TABLE "property_requests" DROP CONSTRAINT IF EXISTS "property_requests_cityId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "properties_deletedAt_moderationStatus_cityId_areaId_propert_idx";

-- Properties: add text columns, backfill from locations, then drop FK ids
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "area" TEXT;

UPDATE "properties" p
SET
  "city" = COALESCE(p."city", c."name"),
  "area" = COALESCE(p."area", a."name")
FROM "locations" c, "locations" a
WHERE p."cityId" = c."id" AND p."areaId" = a."id";

UPDATE "properties" SET "city" = '' WHERE "city" IS NULL;
UPDATE "properties" SET "area" = '' WHERE "area" IS NULL;

ALTER TABLE "properties" DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "cityId";
ALTER TABLE "properties" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "area" SET NOT NULL;

-- Property requests: same pattern
ALTER TABLE "property_requests" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "property_requests" ADD COLUMN IF NOT EXISTS "area" TEXT;

UPDATE "property_requests" pr
SET
  "city" = COALESCE(pr."city", c."name"),
  "area" = COALESCE(pr."area", a."name")
FROM "locations" c, "locations" a
WHERE pr."cityId" = c."id" AND pr."areaId" = a."id";

UPDATE "property_requests" SET "city" = '' WHERE "city" IS NULL;
UPDATE "property_requests" SET "area" = '' WHERE "area" IS NULL;

ALTER TABLE "property_requests" DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "property_requests" DROP COLUMN IF EXISTS "cityId";
ALTER TABLE "property_requests" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "property_requests" ALTER COLUMN "area" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_deletedAt_moderationStatus_city_area_propertyTyp_idx" ON "properties"("deletedAt", "moderationStatus", "city", "area", "propertyType", "listingType", "price");
