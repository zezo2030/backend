import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { DeviceType } from './notification.enums.js';

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, token: string, deviceType: DeviceType): Promise<void> {
    const now = new Date();
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, deviceType, isActive: true, lastSeenAt: now },
      update: { userId, deviceType, isActive: true, lastSeenAt: now }
    });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
  }
}
