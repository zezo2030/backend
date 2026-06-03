import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { IsEntityId } from '../../../common/validation/entity-id.decorator.js';
import { ReportStatus, ReportTargetType } from '../report.enums.js';

export class ReportCreateDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsEntityId()
  targetId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class AdminReportsListQueryDto {
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
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTargetType)
  targetType?: ReportTargetType;
}

export enum ReportResolveOutcome {
  Resolved = 'resolved',
  Dismissed = 'dismissed'
}

export enum ReportResolveActionDto {
  None = 'none',
  DisabledAccount = 'disabled_account',
  DeletedListing = 'deleted_listing'
}

export class AdminReportResolveDto {
  @IsEnum(ReportResolveOutcome)
  outcome!: ReportResolveOutcome;

  @IsOptional()
  @IsEnum(ReportResolveActionDto)
  action?: ReportResolveActionDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
