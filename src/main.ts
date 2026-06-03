import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import * as yaml from 'js-yaml';
import { AppModule } from './app.module.js';
import { FanoutReaper } from './modules/fanout/fanout.reaper.js';
import { FanoutWorker } from './modules/fanout/fanout.worker.js';
import { ReportTargetReconciler } from './modules/reports/report-target-reconciler.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }]
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const contractPath = join(
    process.cwd(),
    '..',
    'specs',
    '001-realestate-backend-api',
    'contracts',
    'openapi.yaml'
  );
  const openApi = yaml.load(readFileSync(contractPath, 'utf8')) as OpenAPIObject;
  SwaggerModule.setup('api/v1/docs', app, openApi);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const logger = app.get(Logger);
  const baseUrl = `http://localhost:${port}`;
  logger.log(`App health: ${baseUrl}/health`, 'Bootstrap');
  logger.log(`Swagger UI: ${baseUrl}/api/v1/docs`, 'Bootstrap');
  logger.log(`Cities:     ${baseUrl}/api/v1/locations/cities`, 'Bootstrap');

  if (process.env.DEV_RUN_WORKER === 'true') {
    const worker = app.get(FanoutWorker);
    const reaper = app.get(FanoutReaper);
    reaper.start();
    void worker.runLoop();
    logger.log('Fanout worker running in-process', 'Bootstrap');
  }

  const reportReconciler = app.get(ReportTargetReconciler);
  reportReconciler.start();
}

void bootstrap();
