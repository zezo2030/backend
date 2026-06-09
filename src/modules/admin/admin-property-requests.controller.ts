import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards
} from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { PropertyRequestUpdateDto } from '../property-requests/dto/property-requests.dto.js';
import { AdminPropertyRequestsService } from './admin-property-requests.service.js';
import {
  AdminPropertyRequestStatusDto,
  AdminPropertyRequestsListQueryDto
} from './dto/admin-property-requests.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/property-requests', version: '1' })
export class AdminPropertyRequestsController {
  constructor(private readonly adminRequests: AdminPropertyRequestsService) {}

  @Get()
  list(@Query() query: AdminPropertyRequestsListQueryDto) {
    return this.adminRequests.list(query);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: AdminPropertyRequestStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminRequests.updateStatus(id, dto, user.sub);
  }

  @Patch(':id')
  updateDetails(
    @Param('id') id: string,
    @Body() dto: PropertyRequestUpdateDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminRequests.updateDetails(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.adminRequests.softDelete(id, user.sub);
  }
}
