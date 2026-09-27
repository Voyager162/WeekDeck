import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.voyager162.timeblocker',
  appName: 'Weekdeck',
  webDir: 'dist',
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  plugins: { LocalNotifications: { presentationOptions: ['sound', 'banner', 'list'] } },
};
export default config;
