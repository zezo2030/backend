import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Public } from '../../common/auth/public.decorator.js';
import { SelectRoleDto } from '../users/dto/users.dto.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto, LogoutDto, RefreshDto, RegisterDto } from './dto/auth.dto.js';
import {
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  PasswordResetVerifyDto
} from './dto/password-reset.dto.js';
import { PasswordResetService } from './password-reset.service.js';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly passwordResetService: PasswordResetService
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.register(
      dto.email,
      dto.password,
      dto.displayName,
      dto.deviceId,
      userAgent
    );
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto.email, dto.password, dto.deviceId, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.refresh(dto.refreshToken, userAgent);
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(204)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    await this.passwordResetService.requestReset(dto.email);
  }

  @Public()
  @Post('password-reset/verify')
  @HttpCode(200)
  verifyPasswordReset(@Body() dto: PasswordResetVerifyDto) {
    return this.passwordResetService.verifyCode(dto.email, dto.code);
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(204)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    await this.passwordResetService.confirmReset(dto.email, dto.resetToken, dto.password);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto): Promise<void> {
    return this.authService.logout(user.sub, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getSelf(user.sub);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Post('select-role')
  @HttpCode(200)
  selectRole(@CurrentUser() user: AuthenticatedUser, @Body() dto: SelectRoleDto) {
    return this.usersService.selectRole(user.sub, dto);
  }
}
