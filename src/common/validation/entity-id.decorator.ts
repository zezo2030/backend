import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';

/** Validates opaque string primary keys (Prisma cuid). */
export function IsEntityId(): PropertyDecorator {
  return applyDecorators(IsString(), IsNotEmpty());
}
