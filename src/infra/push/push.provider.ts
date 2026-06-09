import type { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { loadServiceAccount } from '../firebase/firebase-credentials.js';

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

// Android: data-only so the mobile background handler surfaces the alert via
// Notifee with the branded large icon. iOS: APNS alert (required when killed).
const toFcmMessage = (token: string, message: PushMessage): Message => ({
  token,
  data: toFcmData(message),
  android: {
    priority: 'high',
    ttl: 86400000
  },
  apns: {
    headers: { 'apns-priority': '10' },
    payload: {
      aps: {
        alert: { title: message.title, body: message.body },
        sound: 'default',
        contentAvailable: true
      }
    }
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
