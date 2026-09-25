import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voyager162.timeblocker',
  appName: 'Weekdeck',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_weekdeck',
      iconColor: '#24705B',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
