import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { PUSH_DISPATCHER, type PushDispatcher, type PushTarget } from '../../infra/push/push.provider.js';
import { DeviceTokensInvalidator } from '../notifications/device-tokens-invalidator.service.js';
import { NotificationType } from '../notifications/notification.enums.js';
import { FanoutOutboxStatus } from './fanout.enums.js';

type OutboxJob = {
  id: string;
  requestId: string;
  attempts: number;
};

@Injectable()
export class FanoutWorker {
  private readonly logger = new Logger(FanoutWorker.name);
  private readonly workerId = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_DISPATCHER) private readonly pushDispatcher: PushDispatcher,
    private readonly invalidator: DeviceTokensInvalidator
  ) {}

  async drainOnce(): Promise<boolean> {
    const job = await this.leaseNext();
    if (!job) return false;
    await this.process(job);
    return true;
  }

  async runLoop(intervalMs = 1000): Promise<void> {
    this.running = true;
    while (this.running) {
      const processed = await this.drainOnce();
      if (!processed) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  stop(): void {
    this.running = false;
  }

  private async leaseNext(): Promise<OutboxJob | null> {
    const now = new Date();
    const candidate = await this.prisma.fanoutOutbox.findFirst({
      where: {
        status: FanoutOutboxStatus.pending,
        OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }]
      },
      orderBy: { createdAt: 'asc' }
    });
    if (!candidate) return null;

    const leaseUntil = new Date(now.getTime() + 60000);
    const updated = await this.prisma.fanoutOutbox.updateMany({
      where: {
        id: candidate.id,
        status: FanoutOutboxStatus.pending,
        OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }]
      },
      data: {
        status: FanoutOutboxStatus.in_progress,
        leasedBy: this.workerId,
        leasedUntil: leaseUntil,
        lastError: null,
        attempts: { increment: 1 }
      }
    });
    if (updated.count === 0) return null;

    const job = await this.prisma.fanoutOutbox.findUnique({ where: { id: candidate.id } });
    if (!job) return null;
    return { id: job.id, requestId: job.requestId, attempts: job.attempts };
  }

  private async process(job: OutboxJob): Promise<void> {
    try {
      const request = await this.prisma.propertyRequest.findUnique({
        where: { id: job.requestId }
      });
      if (!request) throw new Error(`Request ${job.requestId} not found`);

      const recipients = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.Broker, Role.Agency] },
          isActive: true,
          deletedAt: null,
          id: { not: request.requesterId }
        },
        select: { id: true }
      });
      const recipientIds = recipients.map((recipient) => recipient.id);

      let processedCount = 0;
      for (let offset = 0; offset < recipientIds.length; offset += 500) {
        const batch = recipientIds.slice(offset, offset + 500);
        processedCount += await this.materializeBatch(request, batch);
        await this.dispatchBatch(request, batch);
        await this.prisma.fanoutOutbox.update({
          where: { id: job.id },
          data: { recipientCount: recipientIds.length, processedCount }
        });
      }

      await this.prisma.fanoutOutbox.update({
        where: { id: job.id },
        data: {
          status: FanoutOutboxStatus.done,
          recipientCount: recipientIds.length,
          processedCount,
          leasedBy: null,
          leasedUntil: null
        }
      });
    } catch (error) {
      const status =
        job.attempts >= 5 ? FanoutOutboxStatus.failed_permanently : FanoutOutboxStatus.pending;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(message);
      await this.prisma.fanoutOutbox.update({
        where: { id: job.id },
        data: {
          status,
          lastError: message.slice(0, 1024),
          leasedBy: null,
          leasedUntil: null
        }
      });
    }
  }

  private async materializeBatch(
    request: { id: string; title: string; description: string },
    recipientIds: string[]
  ): Promise<number> {
    if (recipientIds.length === 0) return 0;
    const result = await this.prisma.notification.createMany({
      data: recipientIds.map((recipientUserId) => ({
        recipientUserId,
        type: NotificationType.new_request_fanout,
        title: request.title,
        body: request.description.slice(0, 500),
        data: { requestId: request.id } as Prisma.InputJsonValue,
        sourceRequestId: request.id
      })),
      skipDuplicates: true
    });
    return result.count;
  }

  private async dispatchBatch(
    request: { id: string; title: string; description: string },
    recipientIds: string[]
  ): Promise<void> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        sourceRequestId: request.id,
        recipientUserId: { in: recipientIds },
        type: NotificationType.new_request_fanout
      },
      select: { id: true, recipientUserId: true, title: true, body: true }
    });
    const notificationByUser = new Map(
      notifications.map((row) => [row.recipientUserId, row])
    );

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: recipientIds }, isActive: true },
      select: { token: true, userId: true }
    });

    const targets: PushTarget[] = [];
    for (const { token, userId } of tokens) {
      const notification = notificationByUser.get(userId);
      if (!notification) continue;
      const body = notification.body.slice(0, 500);
      targets.push({
        token,
        message: {
          title: notification.title,
          body,
          data: {
            type: 'request',
            title: notification.title,
            body,
            targetKind: 'request',
            targetId: request.id,
            notificationId: notification.id
          }
        }
      });
    }

    for (let offset = 0; offset < targets.length; offset += 500) {
      const batch = targets.slice(offset, offset + 500);
      const results = await this.pushDispatcher.dispatchTargets(batch);
      await this.invalidator.invalidate(
        results.filter((result) => result.permanentFailure).map((result) => result.token)
      );
    }
  }
}
