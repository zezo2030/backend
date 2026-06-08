import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { APP_SETTING_KEYS, DEFAULT_APP_SETTINGS, type AppSettings } from './app-settings.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

const CACHE_TTL_MS = 30_000;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: { value: AppSettings; expiresAt: number } | null = null;

  /** Defaults merged with any persisted overrides, served from a short cache. */
  async getAll(): Promise<AppSettings> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.value;

    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: APP_SETTING_KEYS } }
    });
    const overrides: Partial<AppSettings> = {};
    for (const row of rows) {
      (overrides as Record<string, unknown>)[row.key] = row.value;
    }
    const value: AppSettings = { ...DEFAULT_APP_SETTINGS, ...overrides };
    this.cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  async update(dto: UpdateSettingsDto): Promise<AppSettings> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      await this.prisma.$transaction(
        entries.map(([key, value]) =>
          this.prisma.appSetting.upsert({
            where: { key },
            create: { key, value: value as never },
            update: { value: value as never }
          })
        )
      );
      this.cache = null;
    }
    return this.getAll();
  }
}
