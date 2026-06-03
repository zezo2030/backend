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

export class MediaUploadItemDto {
  @IsIn(ALLOWED_IMAGE_CONTENT_TYPES)
  contentType!: (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

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
