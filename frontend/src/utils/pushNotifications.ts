import apiClient from '../api/client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Request permission and subscribe to push notifications.
 * Returns true if subscription succeeded.
 */
export async function subscribeToPush(): Promise<boolean> {
  // Check browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser')
    return false
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return false
    }

    // Get the VAPID public key from the server
    const { data } = await apiClient.get('/push/public-key')
    const publicKey = data.publicKey
    if (!publicKey) {
      console.warn('VAPID public key not configured on server')
      return false
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    // Send subscription to server
    await apiClient.post('/push/subscribe', { subscription })
    return true
  } catch (err) {
    console.error('Failed to subscribe to push:', err)
    return false
  }
}

/**
 * Check if the user is already subscribed.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}
