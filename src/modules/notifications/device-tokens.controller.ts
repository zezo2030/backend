import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { DeviceTokensService } from './device-tokens.service.js';
import { DeviceTokenRegisterDto } from './dto/device-token-register.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard)
@Controller({ path: 'device-tokens', version: '1' })
export class DeviceTokensController {
  constructor(private readonly deviceTokens: DeviceTokensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeviceTokenRegisterDto
  ): Promise<{ status: 'registered' }> {
    await this.deviceTokens.register(user.sub, dto.token, dto.deviceType);
    return { status: 'registered' };
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string
  ): Promise<void> {
    await this.deviceTokens.unregister(user.sub, token);
  }
}
