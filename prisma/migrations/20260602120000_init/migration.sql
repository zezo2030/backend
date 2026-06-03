-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RegularUser', 'Broker', 'Agency', 'Admin');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'house', 'land', 'shop', 'villa', 'building');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('sale', 'rent');

-- CreateEnum
CREATE TYPE "Finishing" AS ENUM ('bare', 'semi_finished', 'finished', 'luxury');

-- CreateEnum
CREATE TYPE "FurnishedStatus" AS ENUM ('furnished', 'unfurnished', 'partially');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('active', 'pending_review', 'rejected');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'reserved', 'sold', 'rented');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('City', 'Area');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('buy', 'rent');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('call', 'whatsapp', 'in_app');

-- CreateEnum
CREATE TYPE "PropertyRequestStatus" AS ENUM ('open', 'in_progress', 'closed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('new_request_fanout', 'admin_broadcast', 'listing_status_change', 'report_resolved');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('property', 'user', 'broker', 'agency');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ReportResolvedAction" AS ENUM ('none', 'disabled_account', 'deleted_listing');

-- CreateEnum
CREATE TYPE "FanoutOutboxStatus" AS ENUM ('pending', 'in_progress', 'done', 'failed_permanently');

-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('all', 'regular_users', 'brokers', 'agencies');

-- CreateEnum
CREATE TYPE "BroadcastOutboxStatus" AS ENUM ('pending', 'in_progress', 'done', 'failed_permanently');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarKey" TEXT,
    "passwordHash" TEXT,
    "role" "Role",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "officeName" TEXT NOT NULL,
    "bio" TEXT,
    "primaryCityId" TEXT,
    "licenseNumber" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "officeName" TEXT NOT NULL,
    "bio" TEXT,
    "primaryCityId" TEXT,
    "licenseNumber" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "address" TEXT,
    "rooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "sizeSqm" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER,
    "finishing" "Finishing",
    "furnished" "FurnishedStatus",
    "moderationStatus" "ModerationStatus" NOT NULL,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'available',
    "rejectionReason" TEXT,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "ownerIsActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "cityId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "minPrice" DECIMAL(19,4) NOT NULL,
    "maxPrice" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "requiredRooms" INTEGER NOT NULL,
    "approxSizeSqm" DOUBLE PRECISION,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "contactMethod" "ContactMethod" NOT NULL,
    "status" "PropertyRequestStatus" NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "sourceRequestId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetExistsAt" TIMESTAMP(3),
    "targetDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAction" "ReportResolvedAction",
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fanout_outbox" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "FanoutOutboxStatus" NOT NULL DEFAULT 'pending',
    "leasedBy" TEXT,
    "leasedUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "recipientCount" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fanout_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_outbox" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "BroadcastOutboxStatus" NOT NULL DEFAULT 'pending',
    "leasedBy" TEXT,
    "leasedUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "recipientCount" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "users_role_isActive_deletedAt_idx" ON "users"("role", "isActive", "deletedAt");
CREATE INDEX "users_role_createdAt_idx" ON "users"("role", "createdAt" DESC);
CREATE UNIQUE INDEX "broker_profiles_userId_key" ON "broker_profiles"("userId");
CREATE INDEX "broker_profiles_primaryCityId_idx" ON "broker_profiles"("primaryCityId");
CREATE UNIQUE INDEX "agency_profiles_userId_key" ON "agency_profiles"("userId");
CREATE INDEX "agency_profiles_primaryCityId_idx" ON "agency_profiles"("primaryCityId");
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_revokedAt_expiresAt_idx" ON "refresh_tokens"("userId", "revokedAt", "expiresAt");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");
CREATE INDEX "locations_type_isActive_name_idx" ON "locations"("type", "isActive", "name");
CREATE UNIQUE INDEX "locations_type_parentId_slug_key" ON "locations"("type", "parentId", "slug");
CREATE INDEX "properties_deletedAt_moderationStatus_availabilityStatus_cr_idx" ON "properties"("deletedAt", "moderationStatus", "availabilityStatus", "createdAt" DESC);
CREATE INDEX "properties_deletedAt_moderationStatus_cityId_areaId_propert_idx" ON "properties"("deletedAt", "moderationStatus", "cityId", "areaId", "propertyType", "listingType", "price");
CREATE INDEX "properties_ownerId_createdAt_idx" ON "properties"("ownerId", "createdAt" DESC);
CREATE INDEX "properties_moderationStatus_createdAt_idx" ON "properties"("moderationStatus", "createdAt" DESC);
CREATE INDEX "property_images_propertyId_sortOrder_idx" ON "property_images"("propertyId", "sortOrder");
CREATE INDEX "property_requests_deletedAt_status_expiresAt_createdAt_idx" ON "property_requests"("deletedAt", "status", "expiresAt", "createdAt" DESC);
CREATE INDEX "property_requests_requesterId_createdAt_idx" ON "property_requests"("requesterId", "createdAt" DESC);
CREATE INDEX "property_requests_status_createdAt_idx" ON "property_requests"("status", "createdAt" DESC);
CREATE INDEX "favorites_userId_createdAt_idx" ON "favorites"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "favorites_userId_propertyId_key" ON "favorites"("userId", "propertyId");
CREATE INDEX "notifications_recipientUserId_createdAt_idx" ON "notifications"("recipientUserId", "createdAt" DESC);
CREATE INDEX "notifications_recipientUserId_readAt_idx" ON "notifications"("recipientUserId", "readAt");
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_userId_isActive_idx" ON "device_tokens"("userId", "isActive");
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt" DESC);
CREATE INDEX "reports_targetType_targetId_status_idx" ON "reports"("targetType", "targetId", "status");
CREATE UNIQUE INDEX "fanout_outbox_requestId_key" ON "fanout_outbox"("requestId");
CREATE INDEX "fanout_outbox_status_leasedUntil_createdAt_idx" ON "fanout_outbox"("status", "leasedUntil", "createdAt");
CREATE INDEX "broadcast_outbox_status_leasedUntil_createdAt_idx" ON "broadcast_outbox"("status", "leasedUntil", "createdAt");
CREATE INDEX "audit_events_action_createdAt_idx" ON "audit_events"("action", "createdAt" DESC);
CREATE INDEX "audit_events_actorUserId_createdAt_idx" ON "audit_events"("actorUserId", "createdAt" DESC);

-- Fanout notification idempotency (partial unique index)
CREATE UNIQUE INDEX "notifications_source_request_recipient_key"
ON "notifications" ("sourceRequestId", "recipientUserId")
WHERE "sourceRequestId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "broker_profiles" ADD CONSTRAINT "broker_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broker_profiles" ADD CONSTRAINT "broker_profiles_primaryCityId_fkey" FOREIGN KEY ("primaryCityId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agency_profiles" ADD CONSTRAINT "agency_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_profiles" ADD CONSTRAINT "agency_profiles_primaryCityId_fkey" FOREIGN KEY ("primaryCityId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "properties" ADD CONSTRAINT "properties_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "properties" ADD CONSTRAINT "properties_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_requests" ADD CONSTRAINT "property_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_requests" ADD CONSTRAINT "property_requests_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_requests" ADD CONSTRAINT "property_requests_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "property_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fanout_outbox" ADD CONSTRAINT "fanout_outbox_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "property_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_outbox" ADD CONSTRAINT "broadcast_outbox_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
