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
import { Public } from '../../common/auth/public.decorator.js';
import { PropertiesFeedQueryDto } from './dto/properties-query.dto.js';
import {
  MinePropertiesQueryDto,
  PropertyAvailabilityDto,
  PropertyCreateDto,
  PropertyUpdateDto
} from './dto/property-write.dto.js';
import { PropertiesCommandService } from './properties.command.service.js';
import { PropertiesQueryService } from './properties.query.service.js';

@Controller({ path: 'properties', version: '1' })
export class PropertiesController {
  constructor(
    private readonly propertiesQueryService: PropertiesQueryService,
    private readonly propertiesCommandService: PropertiesCommandService
  ) {}

  @Public()
  @Get()
  findFeed(@Query() query: PropertiesFeedQueryDto) {
    return this.propertiesQueryService.findFeed(query);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: MinePropertiesQueryDto) {
    return this.propertiesCommandService.listMine(user.sub, query);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: PropertyCreateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.propertiesCommandService.create(dto, user.sub);
  }

  @Public()
  @Get(':id')
  findDetail(@Param('id') id: string) {
    return this.propertiesQueryService.findDetail(id);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: PropertyUpdateDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.propertiesCommandService.update(id, dto, user.sub);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Patch(':id/status')
  updateAvailability(
    @Param('id') id: string,
    @Body() dto: PropertyAvailabilityDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.propertiesCommandService.updateAvailability(id, dto, user.sub);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.propertiesCommandService.softDelete(id, user.sub);
  }

  @UseGuards(JwtAuthGuard, AccountActiveGuard)
  @Get(':id/contact')
  revealContact(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request & { id?: string }
  ) {
    return this.propertiesQueryService.revealContact(id, user.sub, request.id);
  }
}
