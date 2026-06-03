import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { DeviceType } from '../notification.enums.js';

export class DeviceTokenRegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token!: string;

  @IsEnum(DeviceType)
  deviceType!: DeviceType;
}
