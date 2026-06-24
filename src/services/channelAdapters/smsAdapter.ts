/**
 * SMS Channel Adapter
 *
 * Implements the ChannelAdapter interface for SMS delivery.
 * TODO: Integrate with a real SMS provider (e.g., Twilio) for production delivery.
 * Currently simulates successful delivery for MVP purposes.
 */

import { ChannelAdapter } from './index';

interface SmsConfig {
  phone: string;
}

function isSmsConfig(config: unknown): config is SmsConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'phone' in config &&
    typeof (config as SmsConfig).phone === 'string' &&
    (config as SmsConfig).phone.length > 0
  );
}

export const smsAdapter: ChannelAdapter = {
  async send(config: unknown, title: string, body: string): Promise<boolean> {
    if (!isSmsConfig(config)) {
      console.error(
        '[SmsAdapter] Invalid config: missing or empty phone',
        config
      );
      return false;
    }

    // TODO: Replace with real SMS provider integration (e.g., Twilio)
    // Example:
    //   import twilio from 'twilio';
    //   const client = twilio(accountSid, authToken);
    //   await client.messages.create({
    //     to: config.phone,
    //     from: '+1234567890',
    //     body: `${title}: ${body}`,
    //   });
    console.log(
      `[SmsAdapter] Sending SMS — phone: "${config.phone}", title: "${title}", body: "${body}"`
    );

    return true;
  },
};
