import { Module } from '@nestjs/common';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { AdminBlocklistController } from './admin-blocklist.controller.js';
import { BlockedIdentityService } from './blocked-identity.service.js';

@Module({
  imports: [CommonAuthModule],
  controllers: [AdminBlocklistController],
  providers: [BlockedIdentityService],
  exports: [BlockedIdentityService]
})
export class BlocklistModule {}
