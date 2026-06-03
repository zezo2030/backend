import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { IsEntityId } from '../../../common/validation/entity-id.decorator.js';
import { PropertyType } from '../../../common/enums/property-type.enum.js';
import { FurnishedStatus, ListingType } from '../property.enums.js';

export class PropertiesFeedQueryDto {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEntityId()
  cityId?: string;

  @IsOptional()
  @IsEntityId()
  areaId?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  rooms?: number;

  @IsOptional()
  @IsEnum(FurnishedStatus)
  furnished?: FurnishedStatus;
}
