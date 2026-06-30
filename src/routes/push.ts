import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { getPublicKey, saveSubscription, sendPushToUser } from '../services/webPushService';
import { saveExpoPushToken, removeExpoPushToken } from '../services/expoPushService';

const router = Router();

/**
 * GET /public-key — Returns the VAPID public key (needed by the browser to subscribe).
 * Public endpoint (no auth) — the public key is safe to expose.
 */
router.get('/public-key', (_req: Request, res: Response): void => {
  res.json({ publicKey: getPublicKey() });
});

/**
 * POST /subscribe — Save a browser push subscription for the logged-in user.
 * Body: { subscription: { endpoint, keys: { p256dh, auth } } }
 */
router.post(
  '/subscribe',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const { subscription } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }

    try {
      await saveSubscription(req.user!.user_id, req.organizationId!, subscription);
      res.status(201).json({ message: 'Push subscription saved' });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * POST /test — Send a test push notification to the logged-in user.
 */
router.post(
  '/test',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const sent = await sendPushToUser(req.user!.user_id, {
      title: 'Avento Test',
      body: 'Push notifications are working! 🎉',
      type: 'test',
    });
    res.json({ sent });
  }
);

/**
 * POST /register-device — Register an Expo push token for the logged-in user.
 * Body: { token: "ExponentPushToken[...]", platform?: "android" | "ios" }
 */
router.post(
  '/register-device',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const { token, platform } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required and must be a string' });
      return;
    }

    try {
      await saveExpoPushToken(req.user!.user_id, token, platform || 'android');
      res.status(201).json({ message: 'Device registered for push notifications' });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * POST /unregister-device — Remove an Expo push token (e.g., on logout).
 * Body: { token: "ExponentPushToken[...]" }
 */
router.post(
  '/unregister-device',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required and must be a string' });
      return;
    }

    try {
      await removeExpoPushToken(token);
      res.status(200).json({ message: 'Device unregistered from push notifications' });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
