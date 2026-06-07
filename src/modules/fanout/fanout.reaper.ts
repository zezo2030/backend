import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { FanoutOutboxStatus } from './fanout.enums.js';

@Injectable()
export class FanoutReaper {
  private readonly logger = new Logger(FanoutReaper.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async reapExpiredLeases(now = new Date()): Promise<number> {
    const result = await this.prisma.fanoutOutbox.updateMany({
      where: { status: FanoutOutboxStatus.in_progress, leasedUntil: { lt: now } },
      data: { status: FanoutOutboxStatus.pending, leasedBy: null, leasedUntil: null }
    });
    return result.count;
  }

  start(intervalMs = 30000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.reapExpiredLeases().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`reapExpiredLeases failed: ${message}`);
      });
    }, intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
