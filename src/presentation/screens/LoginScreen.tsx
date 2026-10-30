import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Tipografia } from '@/constants/theme';
import { CampoTexto } from '@/presentation/components/CampoTexto';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface LoginScreenProps {
  onEntrar(login: string, senha: string): Promise<{ sucesso: boolean; erro?: string }>;
  onIrParaCadastro(): void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Entrada no app, portada de example/Equinox.MOBILE/src/pages/login.ts.
 *
 * As validações de forma acontecem aqui, antes de consultar o banco, com as
 * mesmas mensagens do app antigo. O caso de uso é que decide sobre credencial
 * e status da conta.
 */
export function LoginScreen({ onEntrar, onIrParaCadastro }: LoginScreenProps) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const { top, bottom } = useSafeAreaInsets();

  const submeter = async () => {
    const informado = login.trim();

    if (!informado) {
      setErro('Informe o e-mail ou usuário.');
      return;
    }
    // Só valida formato quando parece um e-mail: o campo também aceita login.
    if (informado.includes('@') && !EMAIL_REGEX.test(informado)) {
      setErro('O e-mail informado não parece válido.');
      return;
    }
    if (!senha) {
      setErro('Informe a senha.');
      return;
    }

    setErro(null);
    setEntrando(true);
    try {
      const saida = await onEntrar(informado, senha);
      if (!saida.sucesso) setErro(saida.erro ?? 'Não foi possível entrar.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.conteudo,
          { paddingTop: top + Espaco.xxxl, paddingBottom: bottom + Espaco.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.marcaBloco}>
          <Text style={styles.marca}>
            EQUINOX <Text style={styles.produto}>MOBILE</Text>
          </Text>
          <Text style={styles.assinatura}>Celestial Engine</Text>
        </View>

        <Text style={styles.chamada}>Entre com suas credenciais para acessar.</Text>

        <View style={styles.formulario}>
          <CampoTexto
            rotulo="E-mail ou usuário"
            icone="person"
            placeholder="nome@empresa.com"
            value={login}
            onChangeText={(texto) => {
              setLogin(texto);
              setErro(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            keyboardType="email-address"
            testID="input-login"
          />

          <CampoTexto
            rotulo="Sua senha"
            icone="lock"
            placeholder="••••••••"
            value={senha}
            onChangeText={(texto) => {
              setSenha(texto);
              setErro(null);
            }}
            segredo
            autoComplete="current-password"
            onSubmitEditing={submeter}
            returnKeyType="go"
            testID="input-senha"
          />

          {/* Altura reservada para a mensagem não empurrar o botão ao aparecer. */}
          <View style={styles.areaErro}>
            {erro ? (
              <Text style={styles.erro} testID="erro-login">
                {erro}
              </Text>
            ) : null}
          </View>

          <SolarButton
            titulo={entrando ? 'Acessando…' : 'Entrar'}
            carregando={entrando}
            onPress={submeter}
            testID="botao-entrar"
          />

          <SolarButton
            titulo="Não tem conta? Cadastre-se"
            variante="fantasma"
            onPress={onIrParaCadastro}
            testID="botao-cadastro"
          />
        </View>

        <Text style={styles.rodape}>Equinox Energia Solar</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Espaco.xxl,
    gap: Espaco.xxl,
  },
  marcaBloco: { alignItems: 'center', gap: Espaco.sm },
  marca: {
    color: Cores.onSurface,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
  },
  produto: { color: Cores.primary },
  assinatura: {
    ...Tipografia.rotulo,
    color: Cores.onSurfaceVariant,
    opacity: 0.7,
    letterSpacing: 5,
  },
  chamada: {
    ...Tipografia.corpoSm,
    color: Cores.onSurfaceVariant,
    textAlign: 'center',
  },
  formulario: { gap: Espaco.xl },
  areaErro: { minHeight: 20, justifyContent: 'center' },
  erro: { ...Tipografia.corpoSm, color: Cores.error, textAlign: 'center' },
  rodape: {
    ...Tipografia.rotulo,
    color: Cores.onSurfaceVariant,
    opacity: 0.5,
    textAlign: 'center',
  },
});
