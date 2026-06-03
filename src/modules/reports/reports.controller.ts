import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { ReportCreateDto } from './dto/reports.dto.js';
import { ReportsService } from './reports.service.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: ReportCreateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.create(dto, user.sub);
  }
}
