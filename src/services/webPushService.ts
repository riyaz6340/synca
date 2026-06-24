import webpush from 'web-push';
import db from '../config/database';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@avento.app';

let configured = false;

function configure(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[WebPush] VAPID keys not configured. Push notifications disabled.');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function getPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Save a push subscription for a user.
 */
export async function saveSubscription(
  userId: string,
  organizationId: string,
  subscription: PushSubscriptionData
): Promise<void> {
  await db('push_subscriptions')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflict(['user_id', 'endpoint'])
    .merge({
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
}

/**
 * Send a push notification to all devices of a user.
 * Returns true if at least one delivery succeeded.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; type?: string }
): Promise<boolean> {
  if (!configure()) return false;

  const subscriptions = await db('push_subscriptions').where('user_id', userId);
  if (subscriptions.length === 0) return false;

  let anySuccess = false;
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    type: payload.type || 'notification',
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notificationPayload
      );
      anySuccess = true;
    } catch (error) {
      // If subscription expired (410 Gone), remove it
      if ((error as { statusCode?: number }).statusCode === 410) {
        await db('push_subscriptions').where('id', sub.id).del();
      }
      console.warn('[WebPush] Failed to send to a device:', (error as Error).message);
    }
  }

  return anySuccess;
}

/**
 * Send push to a stakeholder (looks up their user_id).
 */
export async function sendPushToStakeholder(
  stakeholderId: string,
  payload: { title: string; body: string; type?: string }
): Promise<boolean> {
  const stakeholder = await db('stakeholders').where('id', stakeholderId).first();
  if (!stakeholder?.user_id) return false;
  return sendPushToUser(stakeholder.user_id, payload);
}
