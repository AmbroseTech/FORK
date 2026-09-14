import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useCallback } from 'react';
import { useSettingsStore } from '@/features/settings/store';

export function useHaptics() {
  const enabled = useSettingsStore((s) => s.haptics);
  const supported = Platform.OS === 'ios' || Platform.OS === 'android';

  const tap = useCallback(() => {
    if (enabled && supported) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [enabled, supported]);
  const success = useCallback(() => {
    if (enabled && supported) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [enabled, supported]);
  const select = useCallback(() => {
    if (enabled && supported) void Haptics.selectionAsync();
  }, [enabled, supported]);

  return { tap, success, select };
}
