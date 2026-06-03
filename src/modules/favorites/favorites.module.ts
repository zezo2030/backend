import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesService } from './favorites.service.js';

@Module({
  imports: [ConfigModule, CommonAuthModule, ObjectStoreModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService]
})
export class FavoritesModule {}
