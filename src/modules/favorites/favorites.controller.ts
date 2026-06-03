import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CursorPaginationParams } from '../../common/pagination/pagination.params.js';
import { FavoritesService } from './favorites.service.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard)
@Controller({ path: 'favorites', version: '1' })
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationParams) {
    return this.favorites.list(user.sub, query.cursor, Math.min(query.limit ?? 20, 100));
  }

  @Put(':propertyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async favorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string
  ): Promise<void> {
    await this.favorites.favorite(user.sub, propertyId);
  }

  @Delete(':propertyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId') propertyId: string
  ): Promise<void> {
    await this.favorites.unfavorite(user.sub, propertyId);
  }
}
