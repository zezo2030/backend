import { randomBytes } from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const createUlid = (date = Date.now()): string => {
  let time = date;
  let output = '';
  for (let index = 9; index >= 0; index -= 1) {
    output = ENCODING[time % 32] + output;
    time = Math.floor(time / 32);
  }

  const random = randomBytes(10);
  for (const byte of random) {
    output += ENCODING[(byte >> 3) & 31];
  }

  return output;
};
