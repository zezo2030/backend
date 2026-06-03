import { Injectable } from '@nestjs/common';
import { BroadcastAudience as PrismaBroadcastAudience, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { BroadcastOutboxStatus } from './broadcast.enums.js';
import { AdminBroadcastDto, BroadcastAudience } from './dto/admin-broadcast.dto.js';

export interface EnqueuedBroadcastDto {
  id: string;
  audience: BroadcastAudience;
  status: BroadcastOutboxStatus;
}

@Injectable()
export class BroadcastService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(dto: AdminBroadcastDto, actorUserId: string): Promise<EnqueuedBroadcastDto> {
    const created = await this.prisma.broadcastOutbox.create({
      data: {
        actorUserId,
        audience: dto.audience as PrismaBroadcastAudience,
        title: dto.title,
        body: dto.body,
        data: (dto.data ?? undefined) as Prisma.InputJsonValue | undefined,
        status: BroadcastOutboxStatus.pending
      }
    });
    return {
      id: created.id,
      audience: created.audience as BroadcastAudience,
      status: created.status
    };
  }
}
