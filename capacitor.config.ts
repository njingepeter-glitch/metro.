import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f646294cb155424b855355e27e90ad06',
  appName: 'realtravo254',
  webDir: 'dist',
  server: {
    url: 'https://f646294c-b155-424b-8553-55e27e90ad06.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Browser: {
      // Use in-app browser for OAuth and payment flows
    }
  }
};

export default config;
