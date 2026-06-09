import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
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
import { ContactMethod, PropertyRequestStatus, RequestType } from '../property-request.enums.js';

export class PropertyRequestCreateDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsEnum(RequestType)
  requestType!: RequestType;

  @IsString()
  @MaxLength(120)
  city!: string;

  @IsString()
  @MaxLength(120)
  area!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  minPrice!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  maxPrice!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  requiredRooms!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  approxSizeSqm?: number;

  @IsOptional()
  @IsBoolean()
  isUrgent = false;

  @IsEnum(ContactMethod)
  contactMethod!: ContactMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class PropertyRequestUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsEnum(RequestType)
  requestType?: RequestType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

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
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  requiredRooms?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  approxSizeSqm?: number;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @IsOptional()
  @IsEnum(ContactMethod)
  contactMethod?: ContactMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsEnum(PropertyRequestStatus)
  status?: PropertyRequestStatus;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class PropertyRequestsFeedQueryDto {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;
}

export class MinePropertyRequestsQueryDto {
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
