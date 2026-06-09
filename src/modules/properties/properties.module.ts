import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module.js';
import { LoggerModule } from '../../common/logging/logger.module.js';
import { ObjectStoreModule } from '../../infra/objectstore/object-store.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { PropertiesCommandService } from './properties.command.service.js';
import { PropertiesController } from './properties.controller.js';
import { PropertiesQueryService } from './properties.query.service.js';
import { PropertyMediaService } from './property-media.service.js';

@Module({
  imports: [AuthModule, LoggerModule, ObjectStoreModule, LocationsModule],
  controllers: [PropertiesController],
  providers: [PropertiesQueryService, PropertiesCommandService, PropertyMediaService],
  exports: [PropertiesQueryService, PropertiesCommandService, PropertyMediaService]
})
export class PropertiesModule {}
