import { SetMetadata } from '@nestjs/common';
import type { Role } from '../enums/role.enum.js';
import { ROLES_KEY } from './auth.constants.js';

export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
