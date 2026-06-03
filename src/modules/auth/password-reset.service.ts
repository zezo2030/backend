import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { MAIL_SENDER, type MailSender } from '../../infra/mail/mail.provider.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export interface PasswordResetVerifyResult {
  resetToken: string;
  expiresInSec: number;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    private readonly auditLogger: AuditLogger
  ) {}

  async requestReset(email: string): Promise<void> {
    const normalized = this.normalizeEmail(email);
    await this.enforceRequestRateLimit(normalized);

    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null, isActive: true },
      select: { id: true, email: true }
    });
    if (!user) {
      return;
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const now = new Date();
    const codeTtlSec = this.config.get<number>('passwordReset.codeTtlSec', 600);
    const expiresAt = new Date(now.getTime() + codeTtlSec * 1000);
    const maxAttempts = this.config.get<number>('passwordReset.maxAttempts', 5);

    await this.prisma.$transaction([
      this.prisma.passwordResetChallenge.updateMany({
        where: { email: normalized, consumedAt: null },
        data: { consumedAt: now }
      }),
      this.prisma.passwordResetChallenge.create({
        data: {
          email: normalized,
          codeHash,
          attemptsRemaining: maxAttempts,
          issuedAt: now,
          expiresAt
        }
      })
    ]);

    const ttlMinutes = Math.ceil(codeTtlSec / 60);
    await this.mailSender.send({
      to: normalized,
      subject: 'إعادة تعيين كلمة المرور — 3qarat',
      text: `كود إعادة تعيين كلمة المرور: ${code} — صالح ${ttlMinutes} دقائق.`
    });

    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.password_reset_requested',
      targetType: 'user',
      targetId: user.id
    });
  }

  async verifyCode(email: string, code: string): Promise<PasswordResetVerifyResult> {
    const normalized = this.normalizeEmail(email);
    const challenge = await this.findActiveChallenge(normalized);
    if (!challenge || challenge.attemptsRemaining <= 0) {
      throw this.invalidCodeError();
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) {
      const attemptsRemaining = challenge.attemptsRemaining - 1;
      await this.prisma.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { attemptsRemaining }
      });
      throw this.invalidCodeError();
    }

    const resetToken = randomBytes(32).toString('base64url');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const resetTokenTtlSec = this.config.get<number>('passwordReset.resetTokenTtlSec', 900);
    const resetTokenExpiresAt = new Date(Date.now() + resetTokenTtlSec * 1000);

    await this.prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: { resetTokenHash, resetTokenExpiresAt }
    });

    return { resetToken, expiresInSec: resetTokenTtlSec };
  }

  async confirmReset(email: string, resetToken: string, password: string): Promise<void> {
    const normalized = this.normalizeEmail(email);
    const now = new Date();
    const challenge = await this.prisma.passwordResetChallenge.findFirst({
      where: {
        email: normalized,
        consumedAt: null,
        resetTokenHash: { not: null },
        resetTokenExpiresAt: { gt: now },
        expiresAt: { gt: now }
      },
      orderBy: { issuedAt: 'desc' }
    });

    if (!challenge?.resetTokenHash) {
      throw this.invalidCodeError();
    }

    const tokenMatches = await bcrypt.compare(resetToken, challenge.resetTokenHash);
    if (!tokenMatches) {
      throw this.invalidCodeError();
    }

    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null, isActive: true },
      select: { id: true }
    });
    if (!user) {
      throw this.invalidCodeError();
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, tokenVersion: { increment: 1 } }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now }
      }),
      this.prisma.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now }
      })
    ]);

    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'auth.password_reset_completed',
      targetType: 'user',
      targetId: user.id
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async findActiveChallenge(email: string) {
    const now = new Date();
    return this.prisma.passwordResetChallenge.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: now },
        resetTokenHash: null
      },
      orderBy: { issuedAt: 'desc' }
    });
  }

  private async enforceRequestRateLimit(email: string): Promise<void> {
    const maxPerHour = this.config.get<number>('passwordReset.maxRequestsPerHour', 3);
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.passwordResetChallenge.findMany({
      where: { email, issuedAt: { gt: oneHourAgo } },
      orderBy: { issuedAt: 'asc' },
      select: { issuedAt: true }
    });
    if (recent.length < maxPerHour) {
      return;
    }

    const oldest = recent[0];
    if (!oldest) {
      return;
    }
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest.issuedAt.getTime() + 3_600_000 - Date.now()) / 1000)
    );
    throw new HttpException(
      {
        code: 'tooManyRequests',
        message: 'Too many password reset requests. Try again later.',
        retryAfterSeconds
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private invalidCodeError(): UnauthorizedException {
    return new UnauthorizedException('Invalid or expired reset code');
  }
}
