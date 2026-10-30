import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { PerfilEnum, rotuloDoPerfil } from '@/domain/enums/PerfilEnum';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { CampoTexto } from '@/presentation/components/CampoTexto';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface PerfilScreenProps {
  nome: string;
  usuario: string;
  email: string;
  perfil: PerfilEnum;
  onSalvarDados(dados: { nome: string; usuario: string; email: string }): Promise<{
    sucesso: boolean;
    erro?: string;
  }>;
  onAlterarSenha(dados: {
    senhaAtual: string;
    novaSenha: string;
    confirmacao: string;
  }): Promise<{ sucesso: boolean; erro?: string }>;
  onSair(): void;
}

type Aviso = { tom: 'sucesso' | 'erro'; texto: string } | null;

const iniciais = (nome: string): string =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('') || 'US';

/** Meu perfil, portada de example/Equinox.MOBILE/src/pages/perfil.ts. */
export function PerfilScreen({
  nome,
  usuario,
  email,
  perfil,
  onSalvarDados,
  onAlterarSenha,
  onSair,
}: PerfilScreenProps) {
  const { bottom } = useSafeAreaInsets();

  const [dados, setDados] = useState({ nome, usuario, email });
  const [avisoDados, setAvisoDados] = useState<Aviso>(null);
  const [salvandoDados, setSalvandoDados] = useState(false);

  const [senhas, setSenhas] = useState({ senhaAtual: '', novaSenha: '', confirmacao: '' });
  const [avisoSenha, setAvisoSenha] = useState<Aviso>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const salvarDados = async () => {
    setAvisoDados(null);
    setSalvandoDados(true);
    try {
      const saida = await onSalvarDados(dados);
      setAvisoDados(
        saida.sucesso
          ? { tom: 'sucesso', texto: 'Dados atualizados com sucesso.' }
          : { tom: 'erro', texto: saida.erro ?? 'Não foi possível salvar.' },
      );
    } finally {
      setSalvandoDados(false);
    }
  };

  const alterarSenha = async () => {
    setAvisoSenha(null);
    setSalvandoSenha(true);
    try {
      const saida = await onAlterarSenha(senhas);

      if (saida.sucesso) {
        setSenhas({ senhaAtual: '', novaSenha: '', confirmacao: '' });
        // O caso de uso já limpou a sessão: a próxima entrada usa a senha nova.
        setAvisoSenha({ tom: 'sucesso', texto: 'Senha alterada. Entre de novo.' });
      } else {
        setAvisoSenha({ tom: 'erro', texto: saida.erro ?? 'Não foi possível alterar.' });
      }
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <View style={styles.raiz}>
      <CabecalhoTela titulo="Meu perfil" />

      <KeyboardAvoidingView
        style={styles.raiz}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.identidade}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>{iniciais(nome)}</Text>
            </View>
            <Text style={[Tipografia.titulo, styles.nome]} numberOfLines={2}>
              {nome}
            </Text>
            <Text style={[Tipografia.rotulo, styles.perfil]}>{rotuloDoPerfil(perfil)}</Text>
          </View>

          <View style={styles.secao}>
            <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Dados do usuário</Text>
            <Text style={[Tipografia.corpoSm, styles.secaoAjuda]}>
              Altere seu nome, e-mail e login.
            </Text>

            {avisoDados ? <Aviso aviso={avisoDados} /> : null}

            <CampoTexto
              rotulo="Nome"
              icone="person"
              value={dados.nome}
              onChangeText={(nomeNovo) => setDados((a) => ({ ...a, nome: nomeNovo }))}
            />
            <CampoTexto
              rotulo="E-mail"
              icone="mail"
              value={dados.email}
              onChangeText={(emailNovo) => setDados((a) => ({ ...a, email: emailNovo }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <CampoTexto
              rotulo="Usuário de login"
              icone="account-circle"
              value={dados.usuario}
              onChangeText={(login) => setDados((a) => ({ ...a, usuario: login }))}
              autoCapitalize="none"
            />

            <SolarButton
              titulo="Salvar dados"
              carregando={salvandoDados}
              onPress={salvarDados}
            />
          </View>

          <View style={styles.divisor} />

          <View style={styles.secao}>
            <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Alterar senha</Text>
            <Text style={[Tipografia.corpoSm, styles.secaoAjuda]}>
              Informe a senha atual e a nova senha duas vezes.
            </Text>

            {avisoSenha ? <Aviso aviso={avisoSenha} /> : null}

            <CampoTexto
              rotulo="Senha atual"
              icone="lock"
              segredo
              value={senhas.senhaAtual}
              onChangeText={(v) => setSenhas((a) => ({ ...a, senhaAtual: v }))}
            />
            <CampoTexto
              rotulo="Nova senha"
              icone="password"
              segredo
              value={senhas.novaSenha}
              onChangeText={(v) => setSenhas((a) => ({ ...a, novaSenha: v }))}
            />
            <CampoTexto
              rotulo="Confirmar nova senha"
              icone="verified-user"
              segredo
              value={senhas.confirmacao}
              onChangeText={(v) => setSenhas((a) => ({ ...a, confirmacao: v }))}
            />

            <SolarButton
              titulo="Alterar senha"
              variante="secundario"
              carregando={salvandoSenha}
              onPress={alterarSenha}
            />
          </View>

          <View style={styles.divisor} />

          <SolarButton titulo="Sair da conta" variante="perigo" icone="logout" onPress={onSair} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Aviso({ aviso }: { aviso: NonNullable<Aviso> }) {
  const ehErro = aviso.tom === 'erro';

  return (
    <View
      style={[
        styles.aviso,
        {
          backgroundColor: ehErro ? Overlay.errorFraco : Overlay.primaryFraco,
          borderColor: ehErro ? Overlay.errorBorda : Overlay.primaryBorda,
        },
      ]}
    >
      <Text style={[Tipografia.corpoSm, { color: ehErro ? Cores.error : Cores.primary }]}>
        {aviso.texto}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xxl, gap: Espaco.xxl },
  identidade: { alignItems: 'center', gap: Espaco.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Raio.pilula,
    backgroundColor: Cores.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: '#000000', fontSize: 26, fontWeight: '900' },
  nome: { color: Cores.onSurface, textAlign: 'center' },
  perfil: { color: Cores.primary },
  secao: { gap: Espaco.lg },
  secaoTitulo: { color: Cores.onSurfaceVariant, opacity: 0.7 },
  secaoAjuda: { color: Cores.onSurfaceVariant, marginTop: -Espaco.md },
  divisor: { height: 1, backgroundColor: Overlay.borda },
  aviso: {
    borderWidth: 1,
    borderRadius: Raio.lg,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.md,
  },
});
