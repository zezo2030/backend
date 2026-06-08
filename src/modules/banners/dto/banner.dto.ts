import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { BannerLinkType } from '@prisma/client';
import { IsEntityId } from '../../../common/validation/entity-id.decorator.js';

export { BannerLinkType };

export class CreateBannerDto {
  @IsString()
  @MaxLength(500)
  imageObjectKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsEnum(BannerLinkType)
  linkType!: BannerLinkType;

  @IsOptional()
  @IsEntityId()
  propertyId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageObjectKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string | null;

  @IsOptional()
  @IsEnum(BannerLinkType)
  linkType?: BannerLinkType;

  @IsOptional()
  @IsString()
  propertyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string | null;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ReorderItemDto {
  @IsEntityId()
  id!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  sortOrder!: number;
}

export class ReorderBannersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
