import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Native Google Sign-In for Capacitor (Android/iOS).
 * Uses @codetrix-studio/capacitor-google-auth to get an ID token,
 * then passes it to Supabase's signInWithIdToken().
 * 
 * Falls back to OAuth redirect for web.
 */
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
    return null; // redirect will happen
  }

  // Native flow
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

  try {
    // Initialize on first call (safe to call multiple times)
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

    // Exchange the Google ID token for a Supabase session
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    // User cancelled sign-in
    if (err?.message?.includes('popup_closed') || err?.message?.includes('canceled')) {
      return null;
    }
    throw err;
  }
}
