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
import { BroadcastWorker } from './modules/admin/broadcast.worker.js';
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

  // The OpenAPI contract lives outside the backend repo (sibling specs/ dir) and
  // may be absent in a backend-only deployment. It only powers the Swagger UI, so
  // a missing file must not crash the API — log and continue without /docs.
  const contractPath =
    process.env.OPENAPI_CONTRACT_PATH ??
    join(process.cwd(), '..', 'specs', '001-realestate-backend-api', 'contracts', 'openapi.yaml');
  try {
    const openApi = yaml.load(readFileSync(contractPath, 'utf8')) as OpenAPIObject;
    SwaggerModule.setup('api/v1/docs', app, openApi);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[bootstrap] Swagger docs disabled — OpenAPI contract not loaded: ${reason}`);
  }

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);

  const logger = app.get(Logger);
  const baseUrl = `http://localhost:${port}`;
  const lanUrl = `http://<your-lan-ip>:${port}`;
  logger.log(`App health: ${baseUrl}/health`, 'Bootstrap');
  logger.log(`Swagger UI: ${baseUrl}/api/v1/docs`, 'Bootstrap');
  logger.log(`Cities:     ${baseUrl}/api/v1/locations/cities`, 'Bootstrap');
  logger.log(`Mobile LAN: set API_BASE_URL=${lanUrl}/api/v1 in mobile/.env`, 'Bootstrap');

  if (process.env.DEV_RUN_WORKER === 'true') {
    const fanoutWorker = app.get(FanoutWorker);
    const broadcastWorker = app.get(BroadcastWorker);
    const reaper = app.get(FanoutReaper);
    reaper.start();
    void fanoutWorker.runLoop();
    void broadcastWorker.runLoop();
    logger.log('Fanout + broadcast workers running in-process', 'Bootstrap');
  }

  const reportReconciler = app.get(ReportTargetReconciler);
  reportReconciler.start();
}

void bootstrap();
