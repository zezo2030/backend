import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RefreshToken, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { BlockedIdentityService } from '../blocklist/blocked-identity.service.js';
import { UsersService, type UserSelf } from '../users/users.service.js';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  roleSelectionRequired: boolean;
  user: UserSelf;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly auditLogger: AuditLogger,
    private readonly blocklist: BlockedIdentityService
  ) {}

  /**
   * Phone + password registration. Mirrors email register but keyed on the
   * E.164 phone number; no SMS/OTP — the password is the sole credential.
   */
  async registerWithPhone(
    phone: string,
    password: string,
    displayName: string,
    deviceId?: string,
    userAgent?: string
  ): Promise<AuthSession> {
    const normalized = phone.trim();
    await this.blocklist.assertNotBlocked(null, normalized);
    const existing = await this.prisma.user.findFirst({
      where: { phone: normalized, deletedAt: null },
      select: { id: true, passwordHash: true, displayName: true }
    });
    if (existing?.passwordHash) {
      throw new ConflictException('An account with this phone already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user: User;
    if (existing) {
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          displayName: existing.displayName || displayName.trim()
        }
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          phone: normalized,
          displayName: displayName.trim(),
          passwordHash,
          role: null,
          isActive: true,
          isVerified: false,
          tokenVersion: 0
        }
      });
    }

    const session = await this.issueSession(user, deviceId, userAgent);
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.register',
      targetType: 'user',
      targetId: user.id,
      metadata: { method: 'phone_password' }
    });
    return session;
  }

  /** Phone + password sign-in. */
  async loginWithPhone(
    phone: string,
    password: string,
    deviceId?: string,
    userAgent?: string
  ): Promise<AuthSession> {
    const normalized = phone.trim();
    const user = await this.prisma.user.findFirst({
      where: { phone: normalized, deletedAt: null }
    });
    const hash =
      user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const passwordMatches = await bcrypt.compare(password, hash);
    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() }
    });

    const session = await this.issueSession(updated, deviceId, userAgent);
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { method: 'phone_password' }
    });
    return session;
  }

  async register(
    email: string,
    password: string,
    displayName: string,
    deviceId?: string,
    userAgent?: string
  ): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    await this.blocklist.assertNotBlocked(normalized, null);
    const existing = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
      select: { id: true, passwordHash: true, displayName: true }
    });
    if (existing?.passwordHash) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user: User;
    if (existing) {
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          displayName: existing.displayName || displayName.trim()
        }
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: normalized,
          displayName: displayName.trim(),
          passwordHash,
          role: null,
          isActive: true,
          isVerified: false,
          tokenVersion: 0
        }
      });
    }

    const session = await this.issueSession(user, deviceId, userAgent);
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.register',
      targetType: 'user',
      targetId: user.id,
      metadata: { method: 'password' }
    });
    return session;
  }

  async login(
    email: string,
    password: string,
    deviceId?: string,
    userAgent?: string
  ): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
      select: {
        id: true,
        email: true,
        displayName: true,
        phone: true,
        avatarKey: true,
        role: true,
        isActive: true,
        isVerified: true,
        tokenVersion: true,
        passwordHash: true,
        createdAt: true
      }
    });
    const hash =
      user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const passwordMatches = await bcrypt.compare(password, hash);
    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() }
    });

    const session = await this.issueSession(updated, deviceId, userAgent);
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { method: 'password' }
    });
    return session;
  }

  async refresh(rawRefreshToken: string, userAgent?: string): Promise<AuthSession> {
    const token = await this.findActiveRefreshToken(rawRefreshToken);
    if (!token) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({ where: { id: token.userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRawToken = this.generateRefreshToken();
    const newHash = await bcrypt.hash(newRawToken, 10);
    const expiresAt = new Date(
      Date.now() + this.config.get<number>('jwt.refreshTtlSec', 2592000) * 1000
    );

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date(), replacedByTokenHash: newHash }
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newHash,
          deviceId: token.deviceId,
          userAgent: userAgent?.slice(0, 256) ?? token.userAgent,
          issuedAt: new Date(),
          expiresAt
        }
      })
    ]);

    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.refresh',
      targetType: 'user',
      targetId: user.id
    });

    return await this.sessionWithRefresh(user, newRawToken);
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const token = await this.findActiveRefreshToken(rawRefreshToken, userId);
    if (token) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() }
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    });
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.logout',
      targetType: 'user',
      targetId: user.id
    });
  }

  private async issueSession(
    user: User,
    deviceId?: string,
    userAgent?: string
  ): Promise<AuthSession> {
    const refreshToken = this.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        deviceId,
        userAgent: userAgent?.slice(0, 256),
        issuedAt: new Date(),
        expiresAt: new Date(
          Date.now() + this.config.get<number>('jwt.refreshTtlSec', 2592000) * 1000
        )
      }
    });
    return await this.sessionWithRefresh(user, refreshToken);
  }

  private async sessionWithRefresh(user: User, refreshToken: string): Promise<AuthSession> {
    const expiresInSec = this.config.get<number>('jwt.accessTtlSec', 900);
    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role, tokenVersion: user.tokenVersion },
      { expiresIn: expiresInSec }
    );
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { brokerProfile: true }
    });
    return {
      accessToken,
      refreshToken,
      expiresInSec,
      roleSelectionRequired: user.role === null,
      user: this.usersService.toSelf(userWithProfile!)
    };
  }

  private async findActiveRefreshToken(
    rawRefreshToken: string,
    userId?: string
  ): Promise<RefreshToken | null> {
    if (!rawRefreshToken) throw new UnprocessableEntityException('refreshToken is required');
    const now = new Date();
    const candidates = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: now },
        ...(userId ? { userId } : {})
      },
      orderBy: { issuedAt: 'desc' },
      take: 100
    });
    for (const candidate of candidates) {
      if (await bcrypt.compare(rawRefreshToken, candidate.tokenHash)) return candidate;
    }
    return null;
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
