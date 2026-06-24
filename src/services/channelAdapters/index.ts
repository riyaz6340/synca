/**
 * Channel Adapter Interface and Dispatcher
 *
 * Defines the contract for notification delivery adapters and provides
 * a dispatcher function that routes delivery to the appropriate adapter.
 * Actual channel implementations (push, SMS, WhatsApp, email) are added
 * in subsequent tasks.
 */

import { pushAdapter } from './pushAdapter';
import { smsAdapter } from './smsAdapter';
import { whatsappAdapter } from './whatsappAdapter';
import { emailAdapter } from './emailAdapter';

export interface ChannelAdapter {
  send(config: unknown, title: string, body: string): Promise<boolean>;
}

/**
 * Attempts delivery of a notification via the specified channel type.
 * Dispatches to the appropriate adapter based on channelType.
 */
export async function deliverViaChannel(
  channelType: string,
  config: unknown,
  title: string,
  body: string
): Promise<boolean> {
  switch (channelType) {
    case 'push_notification':
      return pushAdapter.send(config, title, body);

    case 'sms':
      return smsAdapter.send(config, title, body);

    case 'whatsapp':
      return whatsappAdapter.send(config, title, body);

    case 'email':
      return emailAdapter.send(config, title, body);

    default:
      console.log(
        `[ChannelAdapter] No adapter for "${channelType}" — title: "${title}", body: "${body}", config:`,
        config
      );
      return false;
  }
}
