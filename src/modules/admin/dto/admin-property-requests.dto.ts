import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PropertyRequestStatus } from '../../property-requests/property-request.enums.js';

export class AdminPropertyRequestsListQueryDto {
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

  @IsOptional()
  @IsEnum(PropertyRequestStatus)
  status?: PropertyRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class AdminPropertyRequestStatusDto {
  @IsEnum(PropertyRequestStatus)
  status!: PropertyRequestStatus;
}
