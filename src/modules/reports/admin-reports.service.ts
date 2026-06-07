import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { ReportResolvedAction } from '@prisma/client';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import {
  AdminReportResolveDto,
  AdminReportsListQueryDto,
  ReportResolveActionDto,
  ReportResolveOutcome
} from './dto/reports.dto.js';
import { ReportStatus, ReportTargetType } from './report.enums.js';
import { ReportsService, type ReportDto } from './reports.service.js';

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
    private readonly reportsService: ReportsService
  ) {}

  async list(query: AdminReportsListQueryDto): Promise<{
    items: ReportDto[];
    pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {})
    };

    const [docs, totalItems] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.report.count({ where })
    ]);

    return {
      items: docs.map((doc) => this.reportsService.toDto(doc)),
      pageInfo: {
        page,
        pageSize,
        totalItems,
        totalPages: pageSize === 0 ? 0 : Math.ceil(totalItems / pageSize)
      }
    };
  }

  async resolve(id: string, dto: AdminReportResolveDto, actorUserId: string): Promise<ReportDto> {
    const action = dto.action ?? ReportResolveActionDto.None;

    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) throw new NotFoundException('Report not found');
      if (report.status !== ReportStatus.open) {
        throw new ConflictException({
          code: 'reportAlreadyResolved',
          message: 'Report is not open'
        });
      }

      if (action === ReportResolveActionDto.DisabledAccount) {
        if (
          report.targetType !== ReportTargetType.user &&
          report.targetType !== ReportTargetType.broker
        ) {
          throw new UnprocessableEntityException({
            code: 'reportActionMismatch',
            message: 'disabled_account requires user/broker target'
          });
        }
        const targetUser = await tx.user.findUnique({ where: { id: report.targetId } });
        if (!targetUser || targetUser.deletedAt) {
          throw new UnprocessableEntityException({
            code: 'reportTargetMissing',
            message: 'Target user no longer exists'
          });
        }
        await tx.user.update({
          where: { id: targetUser.id },
          data: { isActive: false, tokenVersion: { increment: 1 } }
        });
        await tx.refreshToken.updateMany({
          where: { userId: targetUser.id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
        await tx.property.updateMany({
          where: { ownerId: targetUser.id },
          data: { ownerIsActive: false }
        });
      } else if (action === ReportResolveActionDto.DeletedListing) {
        if (report.targetType !== ReportTargetType.property) {
          throw new UnprocessableEntityException({
            code: 'reportActionMismatch',
            message: 'deleted_listing requires property target'
          });
        }
        const property = await tx.property.findUnique({ where: { id: report.targetId } });
        if (!property || property.deletedAt) {
          throw new UnprocessableEntityException({
            code: 'reportTargetMissing',
            message: 'Target listing no longer exists'
          });
        }
        await tx.property.update({
          where: { id: property.id },
          data: { deletedAt: new Date() }
        });
      }

      return tx.report.update({
        where: { id: report.id },
        data: {
          status:
            dto.outcome === ReportResolveOutcome.Resolved
              ? ReportStatus.resolved
              : ReportStatus.dismissed,
          resolvedById: actorUserId,
          resolvedAction: this.mapAction(action),
          resolutionNote: dto.note?.trim() ?? null
        }
      });
    });

    await this.auditLogger.log({
      actorUserId,
      action: 'admin.report_resolved',
      targetType: 'report',
      targetId: result.id,
      metadata: {
        outcome: dto.outcome,
        action,
        targetType: result.targetType,
        targetRefId: result.targetId
      }
    });

    if (action === ReportResolveActionDto.DisabledAccount) {
      await this.auditLogger.log({
        actorUserId,
        action: 'admin.user_disabled',
        targetType: 'user',
        targetId: result.targetId,
        metadata: { via: 'report', reportId: result.id }
      });
    } else if (action === ReportResolveActionDto.DeletedListing) {
      await this.auditLogger.log({
        actorUserId,
        action: 'admin.listing_deleted',
        targetType: 'property',
        targetId: result.targetId,
        metadata: { via: 'report', reportId: result.id }
      });
    }

    return this.reportsService.toDto(result);
  }

  private mapAction(action: ReportResolveActionDto): ReportResolvedAction {
    switch (action) {
      case ReportResolveActionDto.DisabledAccount:
        return ReportResolvedAction.disabled_account;
      case ReportResolveActionDto.DeletedListing:
        return ReportResolvedAction.deleted_listing;
      default:
        return ReportResolvedAction.none;
    }
  }
}
