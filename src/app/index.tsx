import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Cores, Espaco, Tipografia } from '@/constants/theme';
import { useAuth } from '@/presentation/hooks/useAuth';

/**
 * Porta de entrada: decide entre login e app a partir da sessão guardada.
 *
 * Usa `<Redirect>` declarativo em vez de `router.replace` num efeito — assim a
 * tela de destino não aparece por um instante antes de ser trocada.
 */
export default function Index() {
  const { isCarregando, isAutenticado } = useAuth();

  if (isCarregando) {
    return (
      <View style={styles.container}>
        <Text style={styles.marca}>
          EQUINOX <Text style={styles.produto}>MOBILE</Text>
        </Text>
        <Text style={styles.assinatura}>Celestial Engine</Text>
        <ActivityIndicator color={Cores.primary} style={styles.carregando} />
      </View>
    );
  }

  return <Redirect href={isAutenticado ? '/(app)/(tabs)/home' : '/login'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.surface,
  },
  marca: {
    color: Cores.onSurface,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  produto: { color: Cores.primary },
  assinatura: {
    ...Tipografia.rotulo,
    color: Cores.onSurfaceVariant,
    marginTop: Espaco.sm,
    letterSpacing: 5,
  },
  carregando: { marginTop: Espaco.xxxl },
});
