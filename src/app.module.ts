import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration.js';
import { envValidationSchema } from './config/env.schema.js';
import { LoggerModule } from './common/logging/logger.module.js';
import { RequestIdMiddleware } from './common/logging/request-id.middleware.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { ObjectStoreModule } from './infra/objectstore/object-store.module.js';
import { PushModule } from './infra/push/push.module.js';
import { MailModule } from './infra/mail/mail.module.js';
import { AuthModule } from './common/auth/auth.module.js';
import { AuthFeatureModule } from './modules/auth/auth.module.js';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { UsersModule } from './modules/users/users.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { PropertiesModule } from './modules/properties/properties.module.js';
import { PropertyRequestsModule } from './modules/property-requests/property-requests.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { FanoutModule } from './modules/fanout/fanout.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { BannersModule } from './modules/banners/banners.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { BlocklistModule } from './modules/blocklist/blocklist.module.js';
import { WellKnownModule } from './modules/well-known/well-known.module.js';
import { LegalModule } from './modules/legal/legal.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false }
    }),
    LoggerModule,
    PrismaModule,
    ObjectStoreModule,
    PushModule,
    MailModule,
    AuthModule,
    AuthFeatureModule,
    UsersModule,
    HealthModule,
    LocationsModule,
    MediaModule,
    PropertiesModule,
    NotificationsModule,
    FavoritesModule,
    PropertyRequestsModule,
    FanoutModule,
    ReportsModule,
    AdminModule,
    BannersModule,
    SettingsModule,
    BlocklistModule,
    WellKnownModule,
    LegalModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
