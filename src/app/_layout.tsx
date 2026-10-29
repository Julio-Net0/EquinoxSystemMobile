import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SolarTheme } from '@/constants/theme';

/**
 * Casca mínima. Os provedores definitivos (SQLiteProvider com as migrações,
 * ContainerProvider com a raiz de composição e AuthProvider) entram no grupo
 * G5, quando o container de injeção de dependência existir.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: SolarTheme.background },
        }}
      />
    </>
  );
}
