import { Module } from '@nestjs/common';
import { AuthModule as CommonAuthModule } from '../../common/auth/auth.module.js';
import { LoggerModule } from '../../common/logging/logger.module.js';
import { AdminReportsController } from './admin-reports.controller.js';
import { AdminReportsService } from './admin-reports.service.js';
import { ReportTargetReconciler } from './report-target-reconciler.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [CommonAuthModule, LoggerModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService, AdminReportsService, ReportTargetReconciler],
  exports: [ReportsService, ReportTargetReconciler]
})
export class ReportsModule {}
