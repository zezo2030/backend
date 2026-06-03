export {
  AvailabilityStatus,
  Finishing,
  FurnishedStatus,
  ListingType,
  ModerationStatus,
  PropertyType
} from '@prisma/client';

export interface PropertyImageRecord {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sortOrder: number;
  uploadedAt: Date;
}
