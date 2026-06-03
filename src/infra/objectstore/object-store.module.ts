import { Module } from '@nestjs/common';
import { ObjectStoreService } from './object-store.service.js';
import { ObjectStoreUrlService } from './object-store-url.service.js';

@Module({
  providers: [ObjectStoreService, ObjectStoreUrlService],
  exports: [ObjectStoreService, ObjectStoreUrlService]
})
export class ObjectStoreModule {}
