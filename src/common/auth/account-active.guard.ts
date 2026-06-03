import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthenticatedUser } from './current-user.decorator.js';

@Injectable()
export class AccountActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const authUser = request.user;
    if (!authUser?.sub) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { isActive: true, tokenVersion: true, deletedAt: true }
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException({ code: 'accountInactive', message: 'Account is inactive' });
    }
    if (user.tokenVersion !== authUser.tokenVersion) {
      throw new UnauthorizedException({
        code: 'invalidTokenVersion',
        message: 'Token has been revoked'
      });
    }
    return true;
  }
}
