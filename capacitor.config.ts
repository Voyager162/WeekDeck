import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voyager162.timeblocker',
  appName: 'Weekdeck',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    LocalNotifications: { presentationOptions: ['badge', 'sound', 'banner', 'list'] },
  },
};

export default config;
