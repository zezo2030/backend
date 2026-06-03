import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsEntityId } from '../../../common/validation/entity-id.decorator.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCityDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case' })
  slug!: string;
}

export class CreateAreaDto {
  @IsEntityId()
  parentId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case' })
  slug!: string;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase kebab-case' })
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
