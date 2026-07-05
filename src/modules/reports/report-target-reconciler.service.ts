import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ReportStatus, ReportTargetType } from './report.enums.js';

@Injectable()
export class ReportTargetReconciler {
  private readonly logger = new Logger(ReportTargetReconciler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async reconcile(): Promise<number> {
    const openReports = await this.prisma.report.findMany({
      where: { status: ReportStatus.open, targetDeleted: false },
      select: { id: true, targetType: true, targetId: true }
    });
    if (openReports.length === 0) return 0;

    const propertyIds = openReports
      .filter((r) => r.targetType === ReportTargetType.property)
      .map((r) => r.targetId);
    const userIds = openReports
      .filter(
        (r) => r.targetType === ReportTargetType.user || r.targetType === ReportTargetType.broker
      )
      .map((r) => r.targetId);

    const [deletedProperties, deletedUsers] = await Promise.all([
      propertyIds.length
        ? this.prisma.property.findMany({
            where: { id: { in: propertyIds }, deletedAt: { not: null } },
            select: { id: true }
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds }, deletedAt: { not: null } },
            select: { id: true }
          })
        : Promise.resolve([])
    ]);

    const deletedSet = new Set<string>([
      ...deletedProperties.map((doc) => doc.id),
      ...deletedUsers.map((doc) => doc.id)
    ]);
    const reportsToFlag = openReports.filter((r) => deletedSet.has(r.targetId)).map((r) => r.id);
    if (reportsToFlag.length === 0) return 0;

    const result = await this.prisma.report.updateMany({
      where: { id: { in: reportsToFlag } },
      data: { targetDeleted: true }
    });
    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} report(s) as target_deleted`);
    }
    return result.count;
  }

  start(intervalMs = 60000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.reconcile().catch((err) =>
        this.logger.error(`Report target reconciler failed: ${(err as Error).message}`)
      );
    }, intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
