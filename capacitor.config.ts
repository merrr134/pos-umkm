import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pitou.pos',
  appName: 'Pitou Cafe',
  webDir: 'public/build',

  server: {
    // Server produksi (Railway) — aplikasi mandiri lewat internet,
    // tanpa laptop/kabel/tunnel. Origin https → PWA/offline aktif penuh.
    url: 'https://pos-umkm-production.up.railway.app',
    androidScheme: 'https',
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
