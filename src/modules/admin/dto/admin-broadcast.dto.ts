import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export enum BroadcastAudience {
  All = 'all',
  RegularUsers = 'regular_users',
  Brokers = 'brokers'
}

export class AdminBroadcastDto {
  @IsEnum(BroadcastAudience)
  audience!: BroadcastAudience;

  @IsString()
  @MaxLength(140)
  title!: string;

  @IsString()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
