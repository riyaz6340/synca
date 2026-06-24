/**
 * WhatsApp Channel Adapter
 *
 * Implements the ChannelAdapter interface for WhatsApp delivery.
 * TODO: Integrate with WhatsApp Business API for production delivery.
 * Currently simulates successful delivery for MVP purposes.
 */

import { ChannelAdapter } from './index';

interface WhatsAppConfig {
  phone: string;
}

function isWhatsAppConfig(config: unknown): config is WhatsAppConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'phone' in config &&
    typeof (config as WhatsAppConfig).phone === 'string' &&
    (config as WhatsAppConfig).phone.length > 0
  );
}

export const whatsappAdapter: ChannelAdapter = {
  async send(config: unknown, title: string, body: string): Promise<boolean> {
    if (!isWhatsAppConfig(config)) {
      console.error(
        '[WhatsAppAdapter] Invalid config: missing or empty phone',
        config
      );
      return false;
    }

    // TODO: Replace with WhatsApp Business API integration
    // Example:
    //   import { Client } from 'whatsapp-business-api';
    //   const client = new Client({ accessToken, phoneNumberId });
    //   await client.messages.send({
    //     to: config.phone,
    //     type: 'text',
    //     text: { body: `${title}: ${body}` },
    //   });
    console.log(
      `[WhatsAppAdapter] Sending WhatsApp message — phone: "${config.phone}", title: "${title}", body: "${body}"`
    );

    return true;
  },
};
