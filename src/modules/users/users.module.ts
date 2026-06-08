import { Module } from '@nestjs/common';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { LoggerModule } from '../../common/logging/logger.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { BlocklistModule } from '../blocklist/blocklist.module.js';
import { OwnerBootstrapService } from './owner-bootstrap.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [LoggerModule, CommonAuthModule, ObjectStoreModule, BlocklistModule],
  controllers: [UsersController],
  providers: [UsersService, OwnerBootstrapService],
  exports: [UsersService]
})
export class UsersModule {}
