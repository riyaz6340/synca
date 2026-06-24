/**
 * Push Notification Channel Adapter
 *
 * Implements the ChannelAdapter interface for push notifications.
 * TODO: Integrate with Firebase Cloud Messaging (FCM) for real delivery.
 * Currently simulates successful delivery for MVP purposes.
 */

import { ChannelAdapter } from './index';

interface PushConfig {
  device_token: string;
}

function isPushConfig(config: unknown): config is PushConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'device_token' in config &&
    typeof (config as PushConfig).device_token === 'string' &&
    (config as PushConfig).device_token.length > 0
  );
}

export const pushAdapter: ChannelAdapter = {
  async send(config: unknown, title: string, body: string): Promise<boolean> {
    if (!isPushConfig(config)) {
      console.error(
        '[PushAdapter] Invalid config: missing or empty device_token',
        config
      );
      return false;
    }

    // TODO: Replace with real FCM integration using firebase-admin SDK
    // Example:
    //   import * as admin from 'firebase-admin';
    //   await admin.messaging().send({
    //     token: config.device_token,
    //     notification: { title, body },
    //   });
    console.log(
      `[PushAdapter] Sending push notification — token: "${config.device_token}", title: "${title}", body: "${body}"`
    );

    return true;
  },
};
