import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum.js';

export class SelectRoleDto {
  @IsIn([Role.RegularUser, Role.Broker, Role.Agency])
  role!: Role.RegularUser | Role.Broker | Role.Agency;

  @ValidateIf((dto: SelectRoleDto) => dto.role === Role.Broker || dto.role === Role.Agency)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  officeName?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @Matches(/^\+\d{8,15}$/)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarKey?: string;
}
