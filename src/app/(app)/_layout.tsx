import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { Cores } from '@/constants/theme';
import { useAuth } from '@/presentation/hooks/useAuth';
import { useCasos } from '@/presentation/context/ContainerProvider';

/**
 * Guarda de sessão de todo o app autenticado.
 *
 * Na versão anterior não havia guarda nenhuma: `/(tabs)/admin` e
 * `/admin/empresas` abriam sem login, bastando o link.
 */
export default function AppLayout() {
  const { isCarregando, isAutenticado } = useAuth();
  const casos = useCasos();

  // Rotinas de abertura. Offline o tempo passa sem nenhum evento, então uma
  // leitura pode cruzar o limite de atraso e uma antiga passar da retenção sem
  // que nada as reavalie — é aqui que isso é verificado.
  useEffect(() => {
    if (!isAutenticado) return;

    (async () => {
      try {
        await casos.avaliarAtrasadas.executar();
        await casos.purgar.executar();
      } catch (erro) {
        // Rotina de manutenção não deve impedir o uso do app.
        console.warn('[equinox] rotinas de abertura falharam', erro);
      }
    })();
  }, [isAutenticado, casos.avaliarAtrasadas, casos.purgar]);

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
