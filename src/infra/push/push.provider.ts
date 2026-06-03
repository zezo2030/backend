import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';

export const PUSH_DISPATCHER = Symbol('PUSH_DISPATCHER');

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushTarget {
  token: string;
  message: PushMessage;
}

export interface PushResult {
  token: string;
  success: boolean;
  permanentFailure?: boolean;
  errorCode?: string;
}

export interface PushDispatcher {
  dispatch(tokens: string[], message: PushMessage): Promise<PushResult[]>;
  dispatchTargets(targets: PushTarget[]): Promise<PushResult[]>;
}

export class StubFcmAdapter implements PushDispatcher {
  readonly dispatchLog: Array<{ tokens: string[]; message: PushMessage }> = [];
  readonly targetDispatchLog: PushTarget[] = [];

  dispatch(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    this.dispatchLog.push({ tokens, message });
    return Promise.resolve(tokens.map((token) => ({ token, success: true })));
  }

  dispatchTargets(targets: PushTarget[]): Promise<PushResult[]> {
    this.targetDispatchLog.push(...targets);
    return Promise.resolve(targets.map(({ token }) => ({ token, success: true })));
  }
}

const toFcmData = (message: PushMessage): Record<string, string> => ({
  title: message.title,
  body: message.body,
  ...Object.fromEntries(
    Object.entries(message.data ?? {}).map(([key, value]) => [key, String(value)])
  )
});

const toFcmMessage = (token: string, message: PushMessage): Message => ({
  token,
  data: toFcmData(message),
  android: { priority: 'high' },
  apns: {
    headers: { 'apns-priority': '10' },
    payload: { aps: { contentAvailable: true } }
  }
});

const mapSendEachResults = (
  tokens: string[],
  responses: Awaited<ReturnType<ReturnType<typeof getMessaging>['sendEach']>>['responses']
): PushResult[] =>
  responses.map((item, index) => {
    const token = tokens[index] ?? '';
    const errorCode = item.error?.code;
    return {
      token,
      success: item.success,
      errorCode,
      permanentFailure:
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token'
    };
  });

function loadServiceAccount(config: ConfigService): ServiceAccount {
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

export class FcmAdapter implements PushDispatcher {
  constructor(config: ConfigService) {
    if (getApps().length === 0) {
      initializeApp({ credential: cert(loadServiceAccount(config)) });
    }
  }

  async dispatch(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    if (tokens.length === 0) return [];
    const messaging = getMessaging();
    const fcmMessage = toFcmMessage(tokens[0] ?? '', message);
    const response = await messaging.sendEachForMulticast({
      tokens,
      data: fcmMessage.data,
      android: fcmMessage.android,
      apns: fcmMessage.apns
    });
    return mapSendEachResults(tokens, response.responses);
  }

  async dispatchTargets(targets: PushTarget[]): Promise<PushResult[]> {
    if (targets.length === 0) return [];
    const messaging = getMessaging();
    const tokens = targets.map((target) => target.token);
    const response = await messaging.sendEach(
      targets.map((target) => toFcmMessage(target.token, target.message))
    );
    return mapSendEachResults(tokens, response.responses);
  }
}
