import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Cores, Overlay } from '@/constants/theme';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { useAuth } from '@/presentation/hooks/useAuth';

/**
 * Abas do app. A de notificações só existe para administrador e super admin;
 * para o técnico ela é escondida com `href: null`, que remove o botão sem
 * tirar a rota do roteador.
 */
export default function TabsLayout() {
  const { perfil } = useAuth();
  const ehAdministrador = perfil === PerfilEnum.ADMIN || perfil === PerfilEnum.SUPER_ADMIN;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Cores.primary,
        tabBarInactiveTintColor: Cores.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: Cores.surfaceContainerLow,
          borderTopColor: Overlay.borda,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: Cores.surface },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="leituras"
        options={{
          title: 'Leituras',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="document-scanner" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Avisos',
          href: ehAdministrador ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
