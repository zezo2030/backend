import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Public } from '../../common/auth/public.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller({ version: '1' })
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/public')
  getPublic() {
    return this.settings.getAll();
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/settings')
  getAdmin() {
    return this.settings.getAll();
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch('admin/settings')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
