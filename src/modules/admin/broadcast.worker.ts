import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { PUSH_DISPATCHER, type PushDispatcher, type PushTarget } from '../../infra/push/push.provider.js';
import { DeviceTokensInvalidator } from '../notifications/device-tokens-invalidator.service.js';
import { NotificationType } from '../notifications/notification.enums.js';
import { BroadcastOutboxStatus } from './broadcast.enums.js';
import { BroadcastAudience } from './dto/admin-broadcast.dto.js';

type OutboxJob = {
  id: string;
  title: string;
  body: string;
  data: Prisma.JsonValue | null;
  audience: BroadcastAudience;
  attempts: number;
};

const AUDIENCE_ROLE_FILTER: Record<BroadcastAudience, Role[] | null> = {
  [BroadcastAudience.All]: null,
  [BroadcastAudience.RegularUsers]: [Role.RegularUser],
  [BroadcastAudience.Brokers]: [Role.Broker]
};

@Injectable()
export class BroadcastWorker {
  private readonly logger = new Logger(BroadcastWorker.name);
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
      try {
        const processed = await this.drainOnce();
        if (!processed) await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        // A transient DB error (e.g. pool exhaustion) must not kill the process.
        // Log and back off, then keep looping.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`runLoop iteration failed, backing off: ${message}`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  private async leaseNext(): Promise<OutboxJob | null> {
    const now = new Date();
    const candidate = await this.prisma.broadcastOutbox.findFirst({
      where: {
        status: BroadcastOutboxStatus.pending,
        OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }]
      },
      orderBy: { createdAt: 'asc' }
    });
    if (!candidate) return null;

    const leaseUntil = new Date(now.getTime() + 60000);
    const updated = await this.prisma.broadcastOutbox.updateMany({
      where: {
        id: candidate.id,
        status: BroadcastOutboxStatus.pending,
        OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }]
      },
      data: {
        status: BroadcastOutboxStatus.in_progress,
        leasedBy: this.workerId,
        leasedUntil: leaseUntil,
        lastError: null,
        attempts: { increment: 1 }
      }
    });
    if (updated.count === 0) return null;

    const job = await this.prisma.broadcastOutbox.findUnique({ where: { id: candidate.id } });
    if (!job) return null;
    return {
      id: job.id,
      title: job.title,
      body: job.body,
      data: job.data,
      audience: job.audience as BroadcastAudience,
      attempts: job.attempts
    };
  }

  private async process(job: OutboxJob): Promise<void> {
    try {
      const roleFilter = AUDIENCE_ROLE_FILTER[job.audience];
      const recipients = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          role: roleFilter ? { in: roleFilter } : { not: null }
        },
        select: { id: true }
      });
      const recipientIds = recipients.map((recipient) => recipient.id);

      let processedCount = 0;
      for (let offset = 0; offset < recipientIds.length; offset += 500) {
        const batch = recipientIds.slice(offset, offset + 500);
        processedCount += await this.materializeBatch(job, batch);
        await this.dispatchBatch(job, batch);
        await this.prisma.broadcastOutbox.update({
          where: { id: job.id },
          data: { recipientCount: recipientIds.length, processedCount }
        });
      }

      await this.prisma.broadcastOutbox.update({
        where: { id: job.id },
        data: {
          status: BroadcastOutboxStatus.done,
          recipientCount: recipientIds.length,
          processedCount,
          leasedBy: null,
          leasedUntil: null
        }
      });
    } catch (error) {
      const status =
        job.attempts >= 5
          ? BroadcastOutboxStatus.failed_permanently
          : BroadcastOutboxStatus.pending;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(message);
      await this.prisma.broadcastOutbox.update({
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

  private async materializeBatch(job: OutboxJob, recipientIds: string[]): Promise<number> {
    if (recipientIds.length === 0) return 0;
    const result = await this.prisma.notification.createMany({
      data: recipientIds.map((recipientUserId) => ({
        recipientUserId,
        type: NotificationType.admin_broadcast,
        title: job.title,
        body: job.body,
        data: (job.data ?? null) as Prisma.InputJsonValue,
        sourceRequestId: null
      })),
      skipDuplicates: true
    });
    return result.count;
  }

  private async dispatchBatch(job: OutboxJob, recipientIds: string[]): Promise<void> {
    const since = new Date(Date.now() - 120_000);
    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientUserId: { in: recipientIds },
        type: NotificationType.admin_broadcast,
        title: job.title,
        body: job.body,
        createdAt: { gte: since }
      },
      select: { id: true, recipientUserId: true, title: true, body: true },
      orderBy: { createdAt: 'desc' }
    });
    const notificationByUser = new Map<string, (typeof notifications)[number]>();
    for (const row of notifications) {
      if (!notificationByUser.has(row.recipientUserId)) {
        notificationByUser.set(row.recipientUserId, row);
      }
    }

    const payloadData =
      job.data && typeof job.data === 'object' && !Array.isArray(job.data)
        ? (job.data as Record<string, unknown>)
        : {};
    const targetKind = String(payloadData.targetKind ?? 'user');
    const targetId = String(payloadData.targetId ?? '');

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
            type: NotificationType.admin_broadcast,
            title: notification.title,
            body,
            targetKind,
            targetId,
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
