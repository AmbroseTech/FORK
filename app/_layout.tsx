import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { useSubscriptionStore } from '@/hooks/useSubscription';

export default function RootLayout() {
  const init = useSubscriptionStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="simulate/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="simulate/running" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="futures" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scenario/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="whatif" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="fork/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
