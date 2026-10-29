import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SolarTheme } from '@/constants/theme';

/**
 * Tela de abertura provisória. O redirecionamento por sessão entra no G6, junto
 * com a árvore de rotas e as guardas.
 */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.marca}>EQUINOX</Text>
      <Text style={styles.produto}>MOBILE</Text>
      <ActivityIndicator color={SolarTheme.primary} style={styles.carregando} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SolarTheme.background,
  },
  marca: {
    color: SolarTheme.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5,
  },
  produto: {
    color: SolarTheme.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5,
  },
  carregando: {
    marginTop: 32,
  },
});
