import { Module } from '@nestjs/common';
import { PushModule } from '../../infra/push/push.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FanoutReaper } from './fanout.reaper.js';
import { FanoutWorker } from './fanout.worker.js';

@Module({
  imports: [PushModule, NotificationsModule],
  providers: [FanoutWorker, FanoutReaper],
  exports: [FanoutWorker, FanoutReaper]
})
export class FanoutModule {}
