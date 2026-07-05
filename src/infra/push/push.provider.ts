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

// Both platforms carry a notification block so the OS renders the alert in the
// background/killed state WITHOUT waking the JS handler — data-only messages are
// not reliably delivered to a backgrounded/stopped Android app, which is why
// pushes only worked while the app was open. `data` still travels for deep-link
// routing on tap; foreground display is handled by the app (onMessage) so no
// duplicate appears. `android.notification` carries the branded icon/colour.
const toFcmMessage = (token: string, message: PushMessage): Message => ({
  token,
  notification: { title: message.title, body: message.body },
  data: toFcmData(message),
  android: {
    priority: 'high',
    ttl: 86400000,
    notification: {
      channelId: 'requests',
      icon: 'ic_stat_notification',
      color: '#0A3C5D',
      defaultSound: true
    }
  },
  apns: {
    headers: { 'apns-priority': '10' },
    payload: {
      aps: {
        alert: { title: message.title, body: message.body },
        sound: 'default'
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
      notification: fcmMessage.notification,
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
