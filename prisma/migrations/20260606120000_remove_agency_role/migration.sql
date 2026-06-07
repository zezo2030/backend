-- Migrate agency accounts to broker before dropping agency support.
INSERT INTO "broker_profiles" (
  "id",
  "userId",
  "officeName",
  "bio",
  "primaryCityId",
  "licenseNumber",
  "isApproved",
  "isFeatured",
  "createdAt",
  "updatedAt"
)
SELECT
  'migrated_' || ap."userId",
  ap."userId",
  ap."officeName",
  ap."bio",
  ap."primaryCityId",
  ap."licenseNumber",
  ap."isApproved",
  ap."isFeatured",
  ap."createdAt",
  ap."updatedAt"
FROM "agency_profiles" ap
WHERE NOT EXISTS (
  SELECT 1 FROM "broker_profiles" bp WHERE bp."userId" = ap."userId"
);

UPDATE "users" SET "role" = 'Broker' WHERE "role" = 'Agency';
UPDATE "reports" SET "targetType" = 'broker' WHERE "targetType" = 'agency';
UPDATE "broadcast_outbox" SET "audience" = 'brokers' WHERE "audience" = 'agencies';

-- DDL below may require table-owner privileges (e.g. Supabase postgres role).
-- Data updates above are sufficient for the API; enum/table cleanup is best-effort.
DO $$
BEGIN
  DROP TABLE IF EXISTS "agency_profiles";
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Skipping DROP agency_profiles: insufficient privilege';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel = 'Agency'
  ) THEN
    CREATE TYPE "Role_new" AS ENUM ('RegularUser', 'Broker', 'Admin');
    ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "Role_new"
      USING ("role"::text::"Role_new");
    DROP TYPE "Role";
    ALTER TYPE "Role_new" RENAME TO "Role";
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Skipping Role enum migration: insufficient privilege';
  WHEN OTHERS THEN
    RAISE WARNING 'Skipping Role enum migration: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ReportTargetType' AND e.enumlabel = 'agency'
  ) THEN
    CREATE TYPE "ReportTargetType_new" AS ENUM ('property', 'user', 'broker');
    ALTER TABLE "reports"
      ALTER COLUMN "targetType" TYPE "ReportTargetType_new"
      USING ("targetType"::text::"ReportTargetType_new");
    DROP TYPE "ReportTargetType";
    ALTER TYPE "ReportTargetType_new" RENAME TO "ReportTargetType";
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Skipping ReportTargetType enum migration: insufficient privilege';
  WHEN OTHERS THEN
    RAISE WARNING 'Skipping ReportTargetType enum migration: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BroadcastAudience' AND e.enumlabel = 'agencies'
  ) THEN
    CREATE TYPE "BroadcastAudience_new" AS ENUM ('all', 'regular_users', 'brokers');
    ALTER TABLE "broadcast_outbox"
      ALTER COLUMN "audience" TYPE "BroadcastAudience_new"
      USING ("audience"::text::"BroadcastAudience_new");
    DROP TYPE "BroadcastAudience";
    ALTER TYPE "BroadcastAudience_new" RENAME TO "BroadcastAudience";
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Skipping BroadcastAudience enum migration: insufficient privilege';
  WHEN OTHERS THEN
    RAISE WARNING 'Skipping BroadcastAudience enum migration: %', SQLERRM;
END $$;
