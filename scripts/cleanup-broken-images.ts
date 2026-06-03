import { config } from 'dotenv';

config();
import { PrismaClient } from '@prisma/client';
import { detectImageType } from '../src/infra/objectstore/image-magic.js';

/**
 * Finds property images and user avatars whose stored object is NOT a real
 * image (the RN Blob-serialization bug stored ~187-byte JSON stubs as
 * image/png). Reports them by default; pass `--apply` to delete the broken
 * storage objects and their DB references so the affected listings/profiles
 * cleanly fall back to the placeholder and owners can re-upload.
 *
 *   npm run images:cleanup            # dry run (report only)
 *   npm run images:cleanup -- --apply # delete broken objects + references
 */

const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !BUCKET) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET in env');
  process.exit(1);
}

const encodePath = (objectKey: string): string =>
  objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');

async function peekBytes(objectKey: string, length: number): Promise<Buffer | null> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(objectKey)}`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
      Range: 'bytes=0-15'
    }
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

/** Returns true when the object is missing or not a supported image. */
async function isBroken(objectKey: string): Promise<boolean> {
  const buf = await peekBytes(objectKey, 16);
  return buf === null || detectImageType(buf) === null;
}

async function deleteObject(objectKey: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(objectKey)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!
    }
  });
}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? 'APPLY (deleting broken objects)' : 'DRY RUN (report only)'}`);

  // --- Property images ---
  const images = await prisma.propertyImage.findMany({
    select: { id: true, propertyId: true, objectKey: true }
  });
  console.log(`\nScanning ${images.length} property images...`);
  let brokenImages = 0;
  for (const image of images) {
    if (await isBroken(image.objectKey)) {
      brokenImages += 1;
      console.log(`  BROKEN  property=${image.propertyId}  key=${image.objectKey}`);
      if (APPLY) {
        await deleteObject(image.objectKey);
        await prisma.propertyImage.delete({ where: { id: image.id } });
      }
    }
  }

  // --- User avatars ---
  const users = await prisma.user.findMany({
    where: { avatarKey: { not: null }, deletedAt: null },
    select: { id: true, email: true, avatarKey: true }
  });
  console.log(`\nScanning ${users.length} user avatars...`);
  let brokenAvatars = 0;
  for (const user of users) {
    if (await isBroken(user.avatarKey!)) {
      brokenAvatars += 1;
      console.log(`  BROKEN  user=${user.email}  key=${user.avatarKey}`);
      if (APPLY) {
        await deleteObject(user.avatarKey!);
        await prisma.user.update({ where: { id: user.id }, data: { avatarKey: null } });
      }
    }
  }

  console.log(
    `\nDone. Broken images: ${brokenImages}/${images.length}, broken avatars: ${brokenAvatars}/${users.length}.`
  );
  if (!APPLY && brokenImages + brokenAvatars > 0) {
    console.log('Re-run with `-- --apply` to remove the broken references.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
