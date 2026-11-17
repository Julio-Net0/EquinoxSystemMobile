import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { Cores } from '@/constants/theme';
import { useAuth } from '@/presentation/hooks/useAuth';

/**
 * Guarda de sessão de todo o app autenticado.
 *
 * Na versão anterior não havia guarda nenhuma: `/(tabs)/admin` e
 * `/admin/empresas` abriam sem login, bastando o link.
 *
 * A guarda só olha a sessão guardada no aparelho, sem falar com a rede: é o
 * que deixa o app abrir autenticado em modo avião. As rotinas de abertura
 * (sincronizar, avaliar atrasos, expurgar) ficam no `SincronizacaoProvider`.
 */
export default function AppLayout() {
  const { isCarregando, isAutenticado } = useAuth();

  if (isCarregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Cores.primary} size="large" />
      </View>
    );
  }

  if (!isAutenticado) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Cores.surface },
      }}
    />
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.surface,
  },
});
