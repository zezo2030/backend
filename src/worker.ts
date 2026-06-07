import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { FanoutReaper } from './modules/fanout/fanout.reaper.js';
import { FanoutWorker } from './modules/fanout/fanout.worker.js';
import { BroadcastWorker } from './modules/admin/broadcast.worker.js';
import { ReportTargetReconciler } from './modules/reports/report-target-reconciler.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const fanoutWorker = app.get(FanoutWorker);
  const broadcastWorker = app.get(BroadcastWorker);
  const reaper = app.get(FanoutReaper);
  const reportReconciler = app.get(ReportTargetReconciler);

  reaper.start();
  reportReconciler.start();
  const shutdown = async () => {
    fanoutWorker.stop();
    broadcastWorker.stop();
    reaper.stop();
    reportReconciler.stop();
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  void broadcastWorker.runLoop();
  await fanoutWorker.runLoop();
}

void bootstrap();
