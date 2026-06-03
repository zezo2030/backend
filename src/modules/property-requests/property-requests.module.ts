import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { LoggerModule } from '../../common/logging/logger.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { PropertyRequestsController } from './property-requests.controller.js';
import { PropertyRequestsService } from './property-requests.service.js';

@Module({
  imports: [ConfigModule, CommonAuthModule, LoggerModule, ObjectStoreModule],
  controllers: [PropertyRequestsController],
  providers: [PropertyRequestsService],
  exports: [PropertyRequestsService]
})
export class PropertyRequestsModule {}
