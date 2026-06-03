import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import type { Request } from 'express';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import {
  MinePropertyRequestsQueryDto,
  PropertyRequestCreateDto,
  PropertyRequestsFeedQueryDto,
  PropertyRequestUpdateDto
} from './dto/property-requests.dto.js';
import { PropertyRequestsService } from './property-requests.service.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard)
@Controller({ path: 'property-requests', version: '1' })
export class PropertyRequestsController {
  constructor(private readonly propertyRequests: PropertyRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: PropertyRequestCreateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.propertyRequests.create(dto, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Broker, Role.Agency)
  @Get()
  findFeed(@Query() query: PropertyRequestsFeedQueryDto) {
    return this.propertyRequests.findFeed(query);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: MinePropertyRequestsQueryDto) {
    return this.propertyRequests.findMine(user.sub, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.propertyRequests.findOne(id, user.sub, user.role as Role | null);
  }

  @Patch(':id')
  updateOwn(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PropertyRequestUpdateDto
  ) {
    return this.propertyRequests.updateOwn(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.propertyRequests.softDelete(id, user.sub, user.role as Role | null);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Broker, Role.Agency)
  @Get(':id/contact')
  revealContact(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request & { id?: string }
  ) {
    return this.propertyRequests.revealContact(id, user.sub, request.id);
  }
}
