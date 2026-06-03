import { Module } from '@nestjs/common';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { DeviceTokensController } from './device-tokens.controller.js';
import { DeviceTokensService } from './device-tokens.service.js';
import { DeviceTokensInvalidator } from './device-tokens-invalidator.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [CommonAuthModule],
  controllers: [NotificationsController, DeviceTokensController],
  providers: [NotificationsService, DeviceTokensService, DeviceTokensInvalidator],
  exports: [NotificationsService, DeviceTokensService, DeviceTokensInvalidator]
})
export class NotificationsModule {}
