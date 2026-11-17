import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { SolarTheme } from '@/constants/theme';
import { migrar } from '@/infrastructure/database/sqlite/migrar';
import { criarMigracoes } from '@/infrastructure/database/sqlite/migrations';
import { HashSenhaAposentado } from '@/infrastructure/security/HashSenhaAposentado';
import { ConfiguracaoAusenteError } from '@/infrastructure/config/ambiente';
import { configurarFonteDeUuid } from '@/infrastructure/security/configurarUuid';
import { ContainerProviderSQLite } from '@/presentation/context/ContainerProviderSQLite';
import { AuthProvider } from '@/presentation/context/AuthContext';
import { ConectividadeProvider } from '@/presentation/context/ConectividadeContext';
import { SincronizacaoProvider } from '@/presentation/context/SincronizacaoContext';

const NOME_BANCO = 'equinox.db';

// Troca o fallback com Math.random do UUIDv4 por bytes de verdade. Roda na
// importação do módulo, antes de qualquer entidade ser criada.
configurarFonteDeUuid();

/**
 * Chamada uma vez pelo SQLiteProvider, na abertura do banco. A migração de
 * seed ainda pede um gateway de hash (foi publicada assim); como a senha local
 * foi aposentada, quem a atende não calcula nada.
 */
async function aoAbrirBanco(db: SQLiteDatabase): Promise<void> {
  await migrar(db, criarMigracoes(new HashSenhaAposentado()));
}

function TelaCarregando() {
  return (
    <View style={styles.centro}>
      <ActivityIndicator color={SolarTheme.primary} size="large" />
      <Text style={styles.textoCarregando}>Preparando o aparelho…</Text>
    </View>
  );
}

/**
 * Captura falha na abertura ou na migração do banco — e a falta das variáveis
 * do Supabase, que impede a montagem do container. Nesse caso o app para
 * aqui, explicando o que falta, em vez de seguir com um cliente de mentira.
 *
 * O Expo Router usa este export como fronteira de erro do segmento. É assim
 * que o SQLiteProvider reporta falha quando está em modo suspense: `onError` e
 * `useSuspense` são mutuamente exclusivos, e passar os dois derruba o app.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const titulo =
    error instanceof ConfiguracaoAusenteError || error.name === 'ConfiguracaoAusenteError'
      ? 'Configuração da nuvem ausente'
      : 'Não foi possível iniciar o app';

  return (
    <View style={styles.centro}>
      <Text style={styles.tituloErro}>{titulo}</Text>
      <Text style={styles.textoErro}>{error.message}</Text>
      <Text style={styles.acaoErro} onPress={() => void retry()}>
        Tentar de novo
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      {/* useSuspense + Suspense é o padrão documentado do expo-sqlite para
          mostrar algo enquanto o banco abre e migra, em vez de tela branca.
          O erro vai para o ErrorBoundary acima, não para onError. */}
      <React.Suspense fallback={<TelaCarregando />}>
        <SQLiteProvider databaseName={NOME_BANCO} onInit={aoAbrirBanco} useSuspense>
          <ContainerProviderSQLite>
            {/* Quatro contextos, de fora para dentro: dependências, sessão,
                rede e sincronização. Cada um só conhece os de fora. */}
            <AuthProvider>
              <ConectividadeProvider>
                <SincronizacaoProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: SolarTheme.background },
                    }}
                  />
                </SincronizacaoProvider>
              </ConectividadeProvider>
            </AuthProvider>
          </ContainerProviderSQLite>
        </SQLiteProvider>
      </React.Suspense>
    </>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SolarTheme.background,
    padding: 24,
  },
  tituloErro: {
    color: SolarTheme.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  textoErro: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  acaoErro: {
    color: SolarTheme.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  textoCarregando: {
    marginTop: 16,
    color: SolarTheme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
