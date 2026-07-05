/**
 * Authoritative image detection by magic bytes — never trust the stored
 * Content-Type. This is the guard against the RN upload bug where a serialized
 * Blob descriptor (`{"_data":{...}}` JSON) was stored with Content-Type
 * `image/png`: the header lies, but the leading bytes do not.
 */
export type DetectedImageType = 'jpeg' | 'png' | 'webp';

const startsWith = (buf: Buffer, bytes: number[]): boolean =>
  bytes.every((byte, index) => buf[index] === byte);

export function detectImageType(buf: Buffer): DetectedImageType | null {
  if (buf.length < 12) {
    return null;
  }
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return 'jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export const isSupportedImage = (buf: Buffer): boolean => detectImageType(buf) !== null;
