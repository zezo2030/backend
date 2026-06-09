import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { LoggerModule } from '../../common/logging/logger.module.js';
import { PushModule } from '../../infra/push/push.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { AdminBroadcastController } from './admin-broadcast.controller.js';
import { AdminLocationsController } from './admin-locations.controller.js';
import { AdminLocationsService } from './admin-locations.service.js';
import { AdminModerationController } from './admin-moderation.controller.js';
import { AdminPropertiesController } from './admin-properties.controller.js';
import { AdminPropertiesService } from './admin-properties.service.js';
import { AdminPropertyRequestsController } from './admin-property-requests.controller.js';
import { AdminPropertyRequestsService } from './admin-property-requests.service.js';
import { AdminStatsController } from './admin-stats.controller.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { BroadcastService } from './broadcast.service.js';
import { BroadcastWorker } from './broadcast.worker.js';
import { StatsService } from './stats.service.js';

@Module({
  imports: [
    ConfigModule,
    CommonAuthModule,
    LoggerModule,
    PushModule,
    ObjectStoreModule,
    NotificationsModule,
    PropertiesModule
  ],
  controllers: [
    AdminUsersController,
    AdminPropertiesController,
    AdminPropertyRequestsController,
    AdminLocationsController,
    AdminBroadcastController,
    AdminStatsController,
    AdminModerationController
  ],
  providers: [
    AdminUsersService,
    AdminPropertiesService,
    AdminPropertyRequestsService,
    AdminLocationsService,
    BroadcastService,
    BroadcastWorker,
    StatsService
  ],
  exports: [BroadcastWorker, StatsService]
})
export class AdminModule {}
