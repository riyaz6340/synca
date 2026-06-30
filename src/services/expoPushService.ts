import db from '../config/database';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Upsert an Expo push token for a user.
 * If the token already exists (different user), it re-assigns to the current user.
 */
export async function saveExpoPushToken(
  userId: string,
  token: string,
  platform: string = 'android'
): Promise<void> {
  await db('expo_push_tokens')
    .insert({
      user_id: userId,
      token,
      platform,
    })
    .onConflict('token')
    .merge({
      user_id: userId,
      platform,
    });
}

/**
 * Remove an Expo push token (e.g., on logout/unregister).
 */
export async function removeExpoPushToken(token: string): Promise<void> {
  await db('expo_push_tokens').where('token', token).del();
}

/**
 * Send an Expo push notification to all devices registered by a user.
 * Returns true if at least one message was accepted by Expo's API.
 */
export async function sendExpoPushToUser(
  userId: string,
  payload: ExpoPushPayload
): Promise<boolean> {
  const tokens = await db('expo_push_tokens').where('user_id', userId).select('token', 'id');

  if (tokens.length === 0) return false;

  const messages: ExpoPushMessage[] = tokens.map((row) => ({
    to: row.token,
    title: payload.title,
    body: payload.body,
    sound: 'default' as const,
    ...(payload.data ? { data: payload.data } : {}),
  }));

  try {
    // Use dynamic import for node's native fetch (available in Node 18+)
    // Falls back to a simple https request via the global fetch or axios-like approach
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.warn('[ExpoPush] Expo API returned non-OK status:', response.status);
      return false;
    }

    const result = await response.json() as { data: ExpoPushTicket[] };
    let anySuccess = false;

    // Process tickets — remove tokens that Expo reports as invalid
    for (let i = 0; i < result.data.length; i++) {
      const ticket = result.data[i];
      if (ticket.status === 'ok') {
        anySuccess = true;
      } else if (
        ticket.details?.error === 'DeviceNotRegistered' ||
        ticket.details?.error === 'InvalidCredentials'
      ) {
        // Token is invalid/expired — remove it
        await db('expo_push_tokens').where('id', tokens[i].id).del();
        console.warn(`[ExpoPush] Removed invalid token for user ${userId}`);
      }
    }

    return anySuccess;
  } catch (error) {
    console.warn('[ExpoPush] Failed to send:', (error as Error).message);
    return false;
  }
}

/**
 * Send an Expo push notification to a stakeholder (looks up their user_id).
 * Same pattern as sendPushToStakeholder in webPushService.ts.
 */
export async function sendExpoPushToStakeholder(
  stakeholderId: string,
  payload: ExpoPushPayload
): Promise<boolean> {
  const stakeholder = await db('stakeholders').where('id', stakeholderId).first();
  if (!stakeholder?.user_id) return false;
  return sendExpoPushToUser(stakeholder.user_id, payload);
}
