import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { FanoutReaper } from './modules/fanout/fanout.reaper.js';
import { FanoutWorker } from './modules/fanout/fanout.worker.js';
import { ReportTargetReconciler } from './modules/reports/report-target-reconciler.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const worker = app.get(FanoutWorker);
  const reaper = app.get(FanoutReaper);
  const reportReconciler = app.get(ReportTargetReconciler);

  reaper.start();
  reportReconciler.start();
  const shutdown = async () => {
    worker.stop();
    reaper.stop();
    reportReconciler.stop();
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  await worker.runLoop();
}

void bootstrap();
