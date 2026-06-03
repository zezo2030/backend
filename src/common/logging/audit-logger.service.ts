import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export interface AuditLogInput {
  actorUserId?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogger {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetId: input.targetId,
        targetType: input.targetType,
        requestId: input.requestId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }
}
