import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { OrphanCleanupService } from './orphan-cleanup.service.js';

@Module({
  imports: [ConfigModule, CommonAuthModule, ObjectStoreModule],
  controllers: [MediaController],
  providers: [MediaService, OrphanCleanupService],
  exports: [MediaService, OrphanCleanupService]
})
export class MediaModule {}
