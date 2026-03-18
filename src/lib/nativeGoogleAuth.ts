import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const isNative = () => Capacitor.isNativePlatform();

export async function signInWithGoogleNative() {
  if (!isNative()) {
    // Web fallback — use standard OAuth redirect
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    return null;
  }

  // Native flow — access the plugin via Capacitor's plugin registry
  // This avoids importing the npm package at build time (which breaks web builds)
  const { Plugins } = await import('@capacitor/core');
  const GoogleAuth = (Plugins as any).GoogleAuth;

  if (!GoogleAuth) {
    throw new Error('GoogleAuth plugin not available. Ensure @codetrix-studio/capacitor-google-auth is installed and synced.');
  }

  try {
    await GoogleAuth.initialize({
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });

    const googleUser = await GoogleAuth.signIn();
    const idToken = googleUser.authentication?.idToken;
    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    if (err?.message?.includes('popup_closed') || err?.message?.includes('canceled')) {
      return null;
    }
    throw err;
  }
}
