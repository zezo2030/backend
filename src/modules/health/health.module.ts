import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { PushModule } from '../../infra/push/push.module.js';

@Module({
  imports: [ObjectStoreModule, PushModule],
  controllers: [HealthController],
  providers: [HealthService]
})
export class HealthModule {}
