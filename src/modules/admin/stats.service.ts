import { Injectable } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ModerationStatus } from '../properties/property.enums.js';
import { PropertyRequestStatus } from '../property-requests/property-request.enums.js';
import { ReportStatus } from '../reports/report.enums.js';

export interface StatsDto {
  users: {
    total: number;
    byRole: Record<'RegularUser' | 'Broker' | 'Admin', number>;
  };
  properties: {
    total: number;
    byStatus: Record<'active' | 'pending_review' | 'rejected' | 'deleted', number>;
  };
  requests: {
    total: number;
    byStatus: Record<'open' | 'in_progress' | 'closed', number>;
  };
  reports: {
    open: number;
    resolved: number;
    dismissed: number;
  };
}

const STATS_TTL_MS = 60_000;

@Injectable()
export class StatsService {
  private cached: { value: StatsDto; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<StatsDto> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;
    const value = await this.compute();
    this.cached = { value, expiresAt: now + STATS_TTL_MS };
    return value;
  }

  invalidate(): void {
    this.cached = null;
  }

  private async compute(): Promise<StatsDto> {
    // Run sequentially rather than via a wide Promise.all: a single stats
    // request must not open ~10 concurrent DB connections at once, which can
    // exceed the (session-mode) pooler limit and surface as a 500. Results are
    // cached for 60s, so the extra latency is paid at most once per minute.
    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      where: { deletedAt: null },
      _count: { _all: true }
    });
    const usersTotal = await this.prisma.user.count({ where: { deletedAt: null } });
    const propertiesByStatus = await this.prisma.property.groupBy({
      by: ['moderationStatus'],
      where: { deletedAt: null },
      _count: { _all: true }
    });
    const propertiesTotal = await this.prisma.property.count();
    const requestsByStatus = await this.prisma.propertyRequest.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true }
    });
    const requestsTotal = await this.prisma.propertyRequest.count({
      where: { deletedAt: null }
    });
    const reportsOpen = await this.prisma.report.count({
      where: { status: ReportStatus.open }
    });
    const reportsResolved = await this.prisma.report.count({
      where: { status: ReportStatus.resolved }
    });
    const reportsDismissed = await this.prisma.report.count({
      where: { status: ReportStatus.dismissed }
    });

    const deletedPropertyCount = await this.prisma.property.count({
      where: { deletedAt: { not: null } }
    });

    const byRole: StatsDto['users']['byRole'] = {
      RegularUser: 0,
      Broker: 0,
      Admin: 0
    };
    for (const row of usersByRole) {
      if (row.role && row.role in byRole) {
        byRole[row.role as keyof StatsDto['users']['byRole']] = row._count._all;
      }
    }

    const byStatus: StatsDto['properties']['byStatus'] = {
      active: 0,
      pending_review: 0,
      rejected: 0,
      deleted: deletedPropertyCount
    };
    for (const row of propertiesByStatus) {
      if (row.moderationStatus === ModerationStatus.active) byStatus.active = row._count._all;
      if (row.moderationStatus === ModerationStatus.pending_review) {
        byStatus.pending_review = row._count._all;
      }
      if (row.moderationStatus === ModerationStatus.rejected) byStatus.rejected = row._count._all;
    }

    const requestStatus: StatsDto['requests']['byStatus'] = {
      open: 0,
      in_progress: 0,
      closed: 0
    };
    for (const row of requestsByStatus) {
      if (row.status in requestStatus) {
        requestStatus[row.status as keyof StatsDto['requests']['byStatus']] = row._count._all;
      }
    }

    return {
      users: { total: usersTotal, byRole },
      properties: { total: propertiesTotal, byStatus },
      requests: { total: requestsTotal, byStatus: requestStatus },
      reports: {
        open: reportsOpen,
        resolved: reportsResolved,
        dismissed: reportsDismissed
      }
    };
  }
}
