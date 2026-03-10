import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Native push notifications for Capacitor (iOS/Android)
 * Falls back gracefully on web — use web push (sw.js) for PWA.
 */

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export async function registerNativePushNotifications(userId: string): Promise<boolean> {
  if (!isNativePlatform()) {
    console.log('Not a native platform, skipping native push registration');
    return false;
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.log('Push notification permission denied');
      return false;
    }

    // Register with APNs / FCM
    await PushNotifications.register();

    // Listen for the registration token
    PushNotifications.addListener('registration', async (token) => {
      console.log('Native push token:', token.value);

      // Save the FCM/APNs token to Supabase
      const subscriptionData: Json = {
        token: token.value,
        platform: Capacitor.getPlatform(), // 'ios' | 'android'
      };

      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase
          .from('push_subscriptions')
          .update({
            subscription_data: subscriptionData,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('push_subscriptions')
          .insert([{ user_id: userId, subscription_data: subscriptionData }]);
      }
    });

    // Handle registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Native push registration error:', error);
    });

    // Handle incoming notifications while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received in foreground:', notification);
      // You can show an in-app toast/banner here
    });

    // Handle notification tap (app opened from notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification tapped:', action);
      const data = action.notification.data;
      if (data?.url) {
        window.location.href = data.url;
      }
    });

    return true;
  } catch (error) {
    console.error('Error registering native push:', error);
    return false;
  }
}

export async function unregisterNativePushNotifications(userId: string): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    await PushNotifications.removeAllListeners();

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing native push subscription:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error unregistering native push:', error);
    return false;
  }
}
