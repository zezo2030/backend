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
import { IsEntityId } from '../../../common/validation/entity-id.decorator.js';
import {
  ContactMethod,
  PropertyRequestStatus,
  RequestType
} from '../property-request.enums.js';

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

  @IsEntityId()
  cityId!: string;

  @IsEntityId()
  areaId!: string;

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
  @IsEntityId()
  cityId?: string;

  @IsOptional()
  @IsEntityId()
  areaId?: string;

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
  @IsEntityId()
  cityId?: string;

  @IsOptional()
  @IsEntityId()
  areaId?: string;
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
