import { Module } from '@nestjs/common';
import { MediaProcessorService } from './media-processor.service.js';
import { ObjectStoreService } from './object-store.service.js';
import { ObjectStoreUrlService } from './object-store-url.service.js';

@Module({
  providers: [ObjectStoreService, ObjectStoreUrlService, MediaProcessorService],
  exports: [ObjectStoreService, ObjectStoreUrlService, MediaProcessorService]
})
export class ObjectStoreModule {}
