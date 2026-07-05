import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform, type TransformFnParams } from 'class-transformer';

const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

// Phone number in E.164 form (e.g. +201234567890). The mobile app normalises
// via libphonenumber before sending.
const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export class PhoneRegisterDto {
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid E.164 number' })
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class PhoneLoginDto {
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid E.164 number' })
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  refreshToken!: string;
}
