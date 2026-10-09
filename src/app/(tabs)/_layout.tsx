import React from 'react';
import { Tabs } from 'expo-router';
import { SolarTheme } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: SolarTheme.surfaceContainer,
          borderTopColor: 'rgba(255, 255, 255, 0.05)',
        },
        tabBarActiveTintColor: SolarTheme.primary,
        tabBarInactiveTintColor: SolarTheme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="usinas"
        options={{
          title: 'Usinas',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Painel Admin',
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Meu Perfil',
        }}
      />
    </Tabs>
  );
}
