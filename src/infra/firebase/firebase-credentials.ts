import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { ServiceAccount } from 'firebase-admin/app';

/**
 * Resolve the Firebase service-account credentials from config. Shared by the
 * FCM push adapter (sending) and the Firebase Admin auth verifier (phone-auth
 * ID-token verification) so both initialise the same Admin app credentials.
 */
export function loadServiceAccount(config: ConfigService): ServiceAccount {
  const accountPath = config.get<string>('firebase.serviceAccountPath');
  if (accountPath) {
    const raw = readFileSync(resolve(accountPath), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      projectId: parsed.project_id ?? parsed.projectId ?? '',
      clientEmail: parsed.client_email ?? parsed.clientEmail ?? '',
      privateKey: (parsed.private_key ?? parsed.privateKey ?? '').replace(/\\n/g, '\n')
    };
  }
  return {
    projectId: config.getOrThrow<string>('firebase.projectId'),
    clientEmail: config.getOrThrow<string>('firebase.clientEmail'),
    privateKey: config.getOrThrow<string>('firebase.privateKey')
  };
}
