import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { AdminReportsService } from './admin-reports.service.js';
import { AdminReportResolveDto, AdminReportsListQueryDto } from './dto/reports.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/reports', version: '1' })
export class AdminReportsController {
  constructor(private readonly adminReports: AdminReportsService) {}

  @Get()
  list(@Query() query: AdminReportsListQueryDto) {
    return this.adminReports.list(query);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Param('id') id: string,
    @Body() dto: AdminReportResolveDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminReports.resolve(id, dto, user.sub);
  }
}
