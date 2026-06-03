import { Decimal } from '@prisma/client/runtime/library';

export function decimalToNumber(value: Decimal | number | string): number {
  if (value instanceof Decimal) return value.toNumber();
  return Number(value);
}

export function toDecimal(value: number | string): Decimal {
  return new Decimal(value);
}
