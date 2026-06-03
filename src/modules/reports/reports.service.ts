import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Report } from '@prisma/client';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { ReportCreateDto } from './dto/reports.dto.js';
import { ReportStatus, ReportTargetType } from './report.enums.js';

export interface ReportDto {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetDeleted: boolean;
  reason: string;
  status: ReportStatus;
  resolvedAction: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger
  ) {}

  async create(dto: ReportCreateDto, reporterId: string): Promise<ReportDto> {
    const exists = await this.targetExists(dto.targetType, dto.targetId);
    if (!exists) {
      throw new UnprocessableEntityException({
        code: 'reportTargetNotFound',
        message: 'Report target not found'
      });
    }

    const created = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        targetExistsAt: new Date(),
        targetDeleted: false,
        reason: dto.reason,
        status: ReportStatus.open
      }
    });

    await this.auditLogger.log({
      actorUserId: reporterId,
      action: 'report.created',
      targetType: dto.targetType,
      targetId: dto.targetId,
      metadata: { reportId: created.id }
    });

    return this.toDto(created);
  }

  toDto(report: Report): ReportDto {
    return {
      id: report.id,
      reporterId: report.reporterId,
      targetType: report.targetType,
      targetId: report.targetId,
      targetDeleted: report.targetDeleted,
      reason: report.reason,
      status: report.status,
      resolvedAction: report.resolvedAction ?? null,
      resolutionNote: report.resolutionNote ?? null,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };
  }

  private async targetExists(type: ReportTargetType, targetId: string): Promise<boolean> {
    if (type === ReportTargetType.property) {
      const property = await this.prisma.property.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { id: true }
      });
      return Boolean(property);
    }
    if (type === ReportTargetType.user) {
      const user = await this.prisma.user.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { id: true }
      });
      return Boolean(user);
    }
    if (type === ReportTargetType.broker) {
      const profile = await this.prisma.brokerProfile.findUnique({
        where: { userId: targetId },
        select: { id: true }
      });
      if (!profile) return false;
      const user = await this.prisma.user.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { id: true }
      });
      return Boolean(user);
    }
    if (type === ReportTargetType.agency) {
      const profile = await this.prisma.agencyProfile.findUnique({
        where: { userId: targetId },
        select: { id: true }
      });
      if (!profile) return false;
      const user = await this.prisma.user.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { id: true }
      });
      return Boolean(user);
    }
    throw new NotFoundException('Unknown target type');
  }
}
