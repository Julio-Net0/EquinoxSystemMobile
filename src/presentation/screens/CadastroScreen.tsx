import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { CampoTexto } from '@/presentation/components/CampoTexto';
import { IconeTile } from '@/presentation/components/IconeTile';
import { ItemSelecionavel, SeletorBusca } from '@/presentation/components/SeletorBusca';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface DadosCadastro {
  nome: string;
  usuario: string;
  email: string;
  empresaId: string;
  senha: string;
  confirmacaoSenha: string;
}

export interface CadastroScreenProps {
  empresas: ItemSelecionavel[];
  carregandoEmpresas: boolean;
  onEnviar(dados: DadosCadastro): Promise<{ sucesso: boolean; erro?: string }>;
  onVoltarAoLogin(): void;
}

const VAZIO: DadosCadastro = {
  nome: '',
  usuario: '',
  email: '',
  empresaId: '',
  senha: '',
  confirmacaoSenha: '',
};

type Passo = 'formulario' | 'conferencia' | 'enviado';

/**
 * Autocadastro público, portada de
 * example/Equinox.MOBILE/src/pages/cadastro.ts.
 *
 * Os dois passos vêm do original: o usuário confere os dados antes de
 * confirmar, e nada é enviado no primeiro passo. A senha não aparece na
 * conferência de propósito.
 */
export function CadastroScreen({
  empresas,
  carregandoEmpresas,
  onEnviar,
  onVoltarAoLogin,
}: CadastroScreenProps) {
  const [passo, setPasso] = useState<Passo>('formulario');
  const [dados, setDados] = useState<DadosCadastro>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { bottom } = useSafeAreaInsets();

  const alterar = (campo: keyof DadosCadastro) => (valor: string) => {
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErro(null);
  };

  const empresaEscolhida = empresas.find((e) => e.id === dados.empresaId);

  const irParaConferencia = () => {
    const { nome, usuario, email, empresaId, senha, confirmacaoSenha } = dados;

    if (!nome.trim() || !usuario.trim() || !email.trim() || !senha) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (!empresaId) {
      setErro('Selecione a empresa à qual você pertence.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (senha !== confirmacaoSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setErro(null);
    setPasso('conferencia');
  };

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);

    try {
      const saida = await onEnviar(dados);
      if (saida.sucesso) {
        setPasso('enviado');
      } else {
        setErro(saida.erro ?? 'Não foi possível concluir o cadastro.');
        // Volta ao formulário: o erro quase sempre é de um campo.
        setPasso('formulario');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (passo === 'enviado') {
    return (
      <View style={styles.raiz}>
        <View style={styles.sucesso}>
          <IconeTile icone="mark-email-read" tamanho={80} />
          <Text style={[Tipografia.titulo, styles.sucessoTitulo]}>Cadastro enviado!</Text>
          <Text style={[Tipografia.corpoSm, styles.sucessoTexto]}>
            Sua conta está aguardando a autorização de um administrador. Você poderá entrar
            assim que ela for aprovada.
          </Text>
          <View style={styles.sucessoAcao}>
            <SolarButton titulo="Voltar ao login" onPress={onVoltarAoLogin} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo="Criar conta"
        onVoltar={passo === 'conferencia' ? () => setPasso('formulario') : onVoltarAoLogin}
      />

      <KeyboardAvoidingView
        style={styles.raiz}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {passo === 'formulario' ? (
            <>
              <CampoTexto
                rotulo="Nome completo"
                icone="person"
                placeholder="Seu nome"
                value={dados.nome}
                onChangeText={alterar('nome')}
                autoComplete="name"
              />
              <CampoTexto
                rotulo="Usuário"
                icone="account-circle"
                placeholder="nome de usuário"
                value={dados.usuario}
                onChangeText={alterar('usuario')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <CampoTexto
                rotulo="E-mail"
                icone="mail"
                placeholder="nome@empresa.com"
                value={dados.email}
                onChangeText={alterar('email')}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <SeletorBusca
                rotulo="Empresa"
                itens={empresas}
                valorId={dados.empresaId || null}
                onSelecionar={alterar('empresaId')}
                placeholder={
                  carregandoEmpresas ? 'Carregando empresas…' : 'Toque para ver as opções'
                }
                textoVazio="Nenhuma empresa encontrada."
                desabilitado={carregandoEmpresas}
              />

              <CampoTexto
                rotulo="Senha"
                icone="lock"
                placeholder="••••••••"
                segredo
                value={dados.senha}
                onChangeText={alterar('senha')}
              />
              <CampoTexto
                rotulo="Confirmar senha"
                icone="lock"
                placeholder="••••••••"
                segredo
                value={dados.confirmacaoSenha}
                onChangeText={alterar('confirmacaoSenha')}
              />

              {erro ? <Text style={styles.erro}>{erro}</Text> : null}

              <SolarButton titulo="Continuar" onPress={irParaConferencia} />
            </>
          ) : (
            <>
              <View style={styles.conferenciaTopo}>
                <IconeTile icone="fact-check" tamanho={56} />
                <Text style={[Tipografia.titulo, styles.conferenciaTitulo]}>
                  Confira seus dados
                </Text>
                <Text style={[Tipografia.corpoSm, styles.conferenciaAjuda]}>
                  Revise antes de confirmar o cadastro.
                </Text>
              </View>

              <View style={styles.resumo}>
                <Linha icone="person" rotulo="Nome" valor={dados.nome} />
                <Linha icone="account-circle" rotulo="Usuário" valor={dados.usuario} />
                <Linha icone="mail" rotulo="E-mail" valor={dados.email} />
                <Linha
                  icone="domain"
                  rotulo="Empresa"
                  valor={empresaEscolhida?.rotulo ?? '—'}
                  ultima
                />
              </View>

              {erro ? <Text style={styles.erro}>{erro}</Text> : null}

              <SolarButton
                titulo="Confirmar cadastro"
                carregando={enviando}
                onPress={confirmar}
              />
              <SolarButton
                titulo="Voltar e editar"
                variante="fantasma"
                onPress={() => setPasso('formulario')}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Linha({
  icone,
  rotulo,
  valor,
  ultima = false,
}: {
  icone: keyof typeof MaterialIcons.glyphMap;
  rotulo: string;
  valor: string;
  ultima?: boolean;
}) {
  return (
    <View style={[styles.linha, !ultima && styles.linhaComBorda]}>
      <MaterialIcons name={icone} size={20} color={Cores.onSurfaceVariant} />
      <View style={styles.linhaTextos}>
        <Text style={[Tipografia.rotulo, styles.linhaRotulo]}>{rotulo}</Text>
        <Text style={[Tipografia.corpo, styles.linhaValor]}>{valor}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xxl, gap: Espaco.xl },
  erro: { ...Tipografia.corpoSm, color: Cores.error, textAlign: 'center' },

  conferenciaTopo: { alignItems: 'center', gap: Espaco.sm },
  conferenciaTitulo: { color: Cores.onSurface, marginTop: Espaco.sm },
  conferenciaAjuda: { color: Cores.onSurfaceVariant },

  resumo: {
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Overlay.borda,
    backgroundColor: Cores.surfaceContainer,
    paddingHorizontal: Espaco.lg,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    paddingVertical: Espaco.md,
  },
  linhaComBorda: { borderBottomWidth: 1, borderBottomColor: Overlay.borda },
  linhaTextos: { flex: 1, gap: 2 },
  linhaRotulo: { color: Cores.onSurfaceVariant, opacity: 0.7 },
  linhaValor: { color: Cores.onSurface },

  sucesso: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espaco.xxl,
    gap: Espaco.md,
  },
  sucessoTitulo: { color: Cores.onSurface, marginTop: Espaco.lg },
  sucessoTexto: { color: Cores.onSurfaceVariant, textAlign: 'center', lineHeight: 21 },
  sucessoAcao: { alignSelf: 'stretch', marginTop: Espaco.xxl },
});
