import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pitou.pos',
  appName: 'Pitou Cafe',
  webDir: 'public/build',

  server: {
    url: 'http://localhost:8000',
    cleartext: true,
    androidScheme: 'http',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 350,
      backgroundColor: '#0A45FE',
      showSpinner: false,
    },
  },
};

export default config;
