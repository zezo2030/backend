import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from './request-id.middleware.js';
import { AuditLogger } from './audit-logger.service.js';
import { createUlid } from './ulid.js';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('nodeEnv') === 'production';
        const configuredLevel = config.get<string>('logLevel', isProduction ? 'info' : 'debug');
        const level = isProduction && configuredLevel === 'debug' ? 'info' : configuredLevel;
        return {
          pinoHttp: {
            level,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.Authorization',
                'req.headers.cookie',
                'req.headers["set-cookie"]',
                'res.headers["set-cookie"]',
                'req.body.refreshToken',
                'req.body.accessToken',
                'req.body.email',
                'req.body.phone',
                'req.body.code',
                'req.body.codeHash',
                'req.body.password',
                'req.body.token',
                'req.query.token',
                '*.refreshToken',
                '*.accessToken',
                '*.email',
                '*.phone',
                '*.codeHash',
                '*.token'
              ],
              censor: '[REDACTED]',
              remove: false
            },
            genReqId: (req, res) => {
              const header = req.headers[REQUEST_ID_HEADER] as string | undefined;
              if (header) return header;
              const existing = res.getHeader(REQUEST_ID_HEADER);
              return typeof existing === 'string' ? existing : createUlid();
            },
            customProps: (req) => ({
              requestId: req.id
            }),
            ...(isProduction
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      translateTime: 'SYS:HH:MM:ss.l',
                      ignore: 'hostname,req,res,responseTime,requestId,context',
                      messageFormat: '{if context}[{context}] {end}{msg}',
                      singleLine: true,
                      colorize: true
                    }
                  }
                })
          }
        };
      }
    })
  ],
  providers: [AuditLogger],
  exports: [PinoLoggerModule, AuditLogger]
})
export class LoggerModule {}
