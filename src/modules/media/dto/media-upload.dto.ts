import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  Min,
  ValidateNested
} from 'class-validator';

export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;
export const ALLOWED_MEDIA_CONTENT_TYPES = [
  ...ALLOWED_IMAGE_CONTENT_TYPES,
  ...ALLOWED_VIDEO_CONTENT_TYPES
] as const;

export type AllowedMediaContentType = (typeof ALLOWED_MEDIA_CONTENT_TYPES)[number];

export const isVideoContentType = (
  contentType: string
): contentType is (typeof ALLOWED_VIDEO_CONTENT_TYPES)[number] =>
  (ALLOWED_VIDEO_CONTENT_TYPES as readonly string[]).includes(contentType);

export class MediaUploadItemDto {
  @IsIn(ALLOWED_MEDIA_CONTENT_TYPES)
  contentType!: AllowedMediaContentType;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class MediaUploadRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MediaUploadItemDto)
  items!: MediaUploadItemDto[];
}
