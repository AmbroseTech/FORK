import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/constants/theme';

const TAB_GLYPH: Record<string, string> = {
  index: '⌥',
  forks: '⑂',
  insights: '◔',
  profile: '◉',
};

function Icon({ name, focused }: { name: string; focused: boolean }) {
  return <Text style={[styles.glyph, focused && { color: colors.accent }]}>{TAB_GLYPH[name] ?? '•'}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ focused }) => <Icon name={route.name} focused={focused} />,
        sceneStyle: { backgroundColor: colors.bg },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'home' }} />
      <Tabs.Screen name="forks" options={{ title: 'forks' }} />
      <Tabs.Screen name="insights" options={{ title: 'insights' }} />
      <Tabs.Screen name="profile" options={{ title: 'profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bgElevated,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 78,
    paddingTop: 8,
  },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5 },
  glyph: { fontSize: 20, color: colors.textDim, fontFamily: fonts.mono },
});
