-- CreateEnum
CREATE TYPE "BannerLinkType" AS ENUM ('property', 'url', 'none');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "imageObjectKey" TEXT NOT NULL,
    "title" TEXT,
    "linkType" "BannerLinkType" NOT NULL DEFAULT 'none',
    "propertyId" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_isActive_sortOrder_idx" ON "banners"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "banners_propertyId_idx" ON "banners"("propertyId");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "blocked_identities" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_identities_email_key" ON "blocked_identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_identities_phone_key" ON "blocked_identities"("phone");

-- CreateIndex
CREATE INDEX "blocked_identities_email_idx" ON "blocked_identities"("email");

-- CreateIndex
CREATE INDEX "blocked_identities_phone_idx" ON "blocked_identities"("phone");
