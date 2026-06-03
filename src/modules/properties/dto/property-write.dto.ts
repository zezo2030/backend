import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { PropertyType } from '../../../common/enums/property-type.enum.js';
import { AvailabilityStatus, Finishing, FurnishedStatus, ListingType } from '../property.enums.js';

export class PropertyCreateDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsEnum(ListingType)
  listingType!: ListingType;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsString()
  @MaxLength(120)
  city!: string;

  @IsString()
  @MaxLength(120)
  area!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  rooms!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  bathrooms!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  sizeSqm!: number;

  @IsOptional()
  @Transform(({ value }) => (value === null ? null : Number(value)))
  @IsInt()
  floor?: number | null;

  @IsOptional()
  @IsEnum(Finishing)
  finishing?: Finishing;

  @IsOptional()
  @IsEnum(FurnishedStatus)
  furnished?: FurnishedStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  imageObjectKeys!: string[];
}

export class PropertyUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  rooms?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  sizeSqm?: number;

  @IsOptional()
  @Transform(({ value }) => (value === null ? null : Number(value)))
  @IsInt()
  floor?: number | null;

  @IsOptional()
  @IsEnum(Finishing)
  finishing?: Finishing;

  @IsOptional()
  @IsEnum(FurnishedStatus)
  furnished?: FurnishedStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  imageObjectKeys?: string[];
}

export class PropertyAvailabilityDto {
  @IsEnum(AvailabilityStatus)
  availabilityStatus!: AvailabilityStatus;
}

export class MinePropertiesQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
