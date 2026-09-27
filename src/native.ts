import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
export const nativeIOS = Capacitor.getPlatform() === 'ios';
export function resizeHaptic() {
  if (nativeIOS) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}
