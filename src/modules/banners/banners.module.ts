import { Module } from '@nestjs/common';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { AdminBannersController } from './admin-banners.controller.js';
import { BannersController } from './banners.controller.js';
import { BannersService } from './banners.service.js';

@Module({
  imports: [CommonAuthModule, ObjectStoreModule],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService]
})
export class BannersModule {}
