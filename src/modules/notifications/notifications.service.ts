import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { NotificationType } from './notification.enums.js';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  sourceRequestId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    page: number,
    pageSize: number,
    unreadOnly: boolean
  ): Promise<{
    items: NotificationDto[];
    pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const where = {
      recipientUserId: userId,
      ...(unreadOnly ? { readAt: null } : {})
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.notification.count({ where })
    ]);

    return {
      items: items.map((notification) => this.toDto(notification)),
      pageInfo: {
        page,
        pageSize,
        totalItems,
        totalPages: pageSize === 0 ? 0 : Math.ceil(totalItems / pageSize)
      }
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientUserId: userId, readAt: null },
      data: { readAt: new Date() }
    });
    if (updated.count > 0) return;

    const exists = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientUserId: userId },
      select: { id: true }
    });
    if (!exists) throw new NotFoundException('Notification not found');
  }

  private toDto(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data as Record<string, unknown> | null,
      sourceRequestId: notification.sourceRequestId,
      readAt: notification.readAt,
      createdAt: notification.createdAt
    };
  }
}
