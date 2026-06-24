/**
 * Email Channel Adapter
 *
 * Implements the ChannelAdapter interface for email delivery.
 * TODO: Integrate with a real email provider (e.g., Nodemailer, SendGrid) for production delivery.
 * Currently simulates successful delivery for MVP purposes.
 */

import { ChannelAdapter } from './index';

interface EmailConfig {
  address: string;
}

function isEmailConfig(config: unknown): config is EmailConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'address' in config &&
    typeof (config as EmailConfig).address === 'string' &&
    (config as EmailConfig).address.length > 0
  );
}

export const emailAdapter: ChannelAdapter = {
  async send(config: unknown, title: string, body: string): Promise<boolean> {
    if (!isEmailConfig(config)) {
      console.error(
        '[EmailAdapter] Invalid config: missing or empty address',
        config
      );
      return false;
    }

    // TODO: Replace with real email delivery integration (e.g., Nodemailer, SendGrid)
    // Example with Nodemailer:
    //   import nodemailer from 'nodemailer';
    //   const transporter = nodemailer.createTransport({ ... });
    //   await transporter.sendMail({
    //     to: config.address,
    //     subject: title,
    //     text: body,
    //   });
    console.log(
      `[EmailAdapter] Sending email — address: "${config.address}", subject: "${title}", body: "${body}"`
    );

    return true;
  },
};
