import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Tipografia } from '@/constants/theme';
import { EmpresaOutputDTO } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { CamposEndereco, EnderecoEstruturaDTO } from '@/application/use-cases/GerenciarEstruturaUseCase';
import { PadraoItem } from '@/presentation/hooks/useEstrutura';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { CampoTexto } from '@/presentation/components/CampoTexto';
import { Cartao } from '@/presentation/components/Cartao';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { IconeTile } from '@/presentation/components/IconeTile';
import { ModalShell } from '@/presentation/components/ModalShell';
import { PilulaStatus } from '@/presentation/components/PilulaStatus';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface GestaoEstruturaScreenProps {
  ehSuperAdmin: boolean;
  empresas: EmpresaOutputDTO[];
  empresaAberta: EmpresaOutputDTO | null;
  enderecos: EnderecoEstruturaDTO[];
  padroesPorEndereco: Record<string, PadraoItem[]>;
  carregando: boolean;
  erro: string | null;
  processando: boolean;
  onAbrirEmpresa(empresa: EmpresaOutputDTO | null): void;
  onCarregarPadroes(enderecoId: string): void;
  onCriarEmpresa(nome: string, cnpj: string): Promise<string | null>;
  onCriarEndereco(campos: CamposEndereco, numerosDePadrao: string[]): Promise<string | null>;
  onAtualizarEndereco(enderecoId: string, campos: CamposEndereco): Promise<string | null>;
  onExcluirEndereco(enderecoId: string): Promise<string | null>;
  onCriarPadrao(enderecoId: string, numero: string): Promise<string | null>;
  onExcluirPadrao(padraoId: string, enderecoId: string): Promise<string | null>;
  onVoltar(): void;
}

const CAMPOS_VAZIOS: CamposEndereco = {
  apelido: '',
  uc: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  ehUsina: false,
};

/**
 * Gerenciar estrutura, portada de
 * example/Equinox.MOBILE/src/pages/estrutura.ts.
 *
 * Como no original, o super admin entra pela lista de empresas e abre uma para
 * ver os endereços; o administrador vai direto aos da própria empresa.
 */
export function GestaoEstruturaScreen(props: GestaoEstruturaScreenProps) {
  const {
    ehSuperAdmin, empresas, empresaAberta, enderecos, padroesPorEndereco,
    carregando, erro, processando,
    onAbrirEmpresa, onCarregarPadroes, onCriarEmpresa, onCriarEndereco,
    onAtualizarEndereco, onExcluirEndereco, onCriarPadrao, onExcluirPadrao, onVoltar,
  } = props;

  const { bottom } = useSafeAreaInsets();

  const [modalEmpresa, setModalEmpresa] = useState(false);
  const [modalEndereco, setModalEndereco] = useState<'criar' | 'editar' | null>(null);
  const [emEdicao, setEmEdicao] = useState<EnderecoEstruturaDTO | null>(null);
  const [emExclusao, setEmExclusao] = useState<EnderecoEstruturaDTO | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const mostrandoEmpresas = ehSuperAdmin && empresaAberta === null;

  const alternarExpandido = (enderecoId: string) => {
    if (expandido === enderecoId) {
      setExpandido(null);
      return;
    }
    setExpandido(enderecoId);
    if (!padroesPorEndereco[enderecoId]) onCarregarPadroes(enderecoId);
  };

  if (mostrandoEmpresas) {
    return (
      <View style={styles.raiz}>
        <CabecalhoTela
          titulo="Empresas"
          subtitulo="Toque numa empresa para ver os endereços"
          onVoltar={onVoltar}
        />

        <FlatList
          data={empresas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
          ListHeaderComponent={
            <View style={styles.topo}>
              <SolarButton
                titulo="Nova empresa"
                variante="secundario"
                icone="add"
                onPress={() => {
                  setErroModal(null);
                  setModalEmpresa(true);
                }}
              />
              {erro ? <Text style={styles.erro}>{erro}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            carregando ? (
              <ActivityIndicator color={Cores.primary} style={styles.carregando} />
            ) : (
              <EstadoVazio icone="domain-disabled" titulo="Nenhuma empresa cadastrada" />
            )
          }
          renderItem={({ item }) => (
            <Cartao onPress={() => onAbrirEmpresa(item)}>
              <View style={styles.linha}>
                <IconeTile icone="domain" tamanho={44} />
                <View style={styles.textos}>
                  <Text style={[Tipografia.tituloCard, styles.titulo]} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={[Tipografia.meta, styles.meta]}>{item.cnpj}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={Cores.primary} />
              </View>
            </Cartao>
          )}
        />

        <ModalEmpresa
          visivel={modalEmpresa}
          erro={erroModal}
          salvando={processando}
          onConfirmar={async (nome, cnpj) => {
            const falha = await onCriarEmpresa(nome, cnpj);
            if (falha) {
              setErroModal(falha);
              return;
            }
            setModalEmpresa(false);
          }}
          onFechar={() => setModalEmpresa(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo={empresaAberta?.nome ?? 'Endereços'}
        subtitulo="Endereços e padrões"
        onVoltar={ehSuperAdmin ? () => onAbrirEmpresa(null) : onVoltar}
      />

      <FlatList
        data={enderecos}
        keyExtractor={(item) => item.enderecoId}
        contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
        ListHeaderComponent={
          <View style={styles.topo}>
            <SolarButton
              titulo="Novo endereço"
              variante="secundario"
              icone="add-location-alt"
              onPress={() => {
                setErroModal(null);
                setEmEdicao(null);
                setModalEndereco('criar');
              }}
            />
            {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator color={Cores.primary} style={styles.carregando} />
          ) : (
            <EstadoVazio
              icone="location-off"
              titulo="Nenhum endereço cadastrado"
              descricao="Todo endereço precisa de ao menos um padrão Cemig."
            />
          )
        }
        renderItem={({ item }) => (
          <Cartao>
            <View style={styles.cartao}>
              <View style={styles.linha}>
                <IconeTile
                  icone={item.ehUsina ? 'solar-power' : 'location-on'}
                  tamanho={44}
                />

                <View style={styles.textos}>
                  <View style={styles.cabecalho}>
                    <Text style={[Tipografia.tituloCard, styles.titulo]} numberOfLines={1}>
                      {item.apelido}
                    </Text>
                    {item.ehUsina ? <PilulaStatus texto="Usina" tom="primary" /> : null}
                  </View>

                  <Text style={[Tipografia.meta, styles.meta]}>UC {item.uc}</Text>

                  {item.logradouro ? (
                    <Text style={[Tipografia.meta, styles.meta]} numberOfLines={1}>
                      {item.logradouro}
                    </Text>
                  ) : null}

                  <Text style={[Tipografia.meta, styles.meta]}>
                    {item.totalPadroes === 1 ? '1 padrão' : `${item.totalPadroes} padrões`}
                    {!item.temGeocerca ? ' · sem coordenada' : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.acoes}>
                <AcaoIcone
                  icone="edit"
                  rotulo="Editar"
                  cor={Cores.primary}
                  onPress={() => {
                    setErroModal(null);
                    setEmEdicao(item);
                    setModalEndereco('editar');
                  }}
                />
                <AcaoIcone
                  icone="delete"
                  rotulo="Excluir"
                  cor={Cores.error}
                  onPress={() => {
                    setErroModal(null);
                    setEmExclusao(item);
                  }}
                />
                <AcaoIcone
                  icone={expandido === item.enderecoId ? 'expand-less' : 'expand-more'}
                  rotulo="Padrões"
                  cor={Cores.onSurfaceVariant}
                  onPress={() => alternarExpandido(item.enderecoId)}
                />
              </View>

              {expandido === item.enderecoId ? (
                <GavetaPadroes
                  enderecoId={item.enderecoId}
                  padroes={padroesPorEndereco[item.enderecoId]}
                  processando={processando}
                  onCriar={onCriarPadrao}
                  onExcluir={onExcluirPadrao}
                />
              ) : null}
            </View>
          </Cartao>
        )}
      />

      {modalEndereco ? (
        <ModalEndereco
          modo={modalEndereco}
          inicial={emEdicao}
          erro={erroModal}
          salvando={processando}
          onConfirmar={async (campos, numeros) => {
            const falha =
              modalEndereco === 'criar'
                ? await onCriarEndereco(campos, numeros)
                : await onAtualizarEndereco(emEdicao!.enderecoId, campos);

            if (falha) {
              setErroModal(falha);
              return;
            }
            setModalEndereco(null);
          }}
          onFechar={() => setModalEndereco(null)}
        />
      ) : null}

      <ModalShell
        visivel={emExclusao !== null}
        tema="erro"
        icone="delete"
        titulo="Excluir endereço?"
        subtitulo={
          emExclusao
            ? `${emExclusao.apelido} · UC ${emExclusao.uc}. Os padrões e as leituras deste endereço também serão removidos.`
            : undefined
        }
        erro={erroModal ?? undefined}
        confirmarLabel="Excluir endereço"
        cancelarLabel="Voltar"
        confirmando={processando}
        onConfirmar={async () => {
          if (!emExclusao) return;
          const falha = await onExcluirEndereco(emExclusao.enderecoId);
          if (falha) {
            setErroModal(falha);
            return;
          }
          setEmExclusao(null);
        }}
        onFechar={() => setEmExclusao(null)}
      />
    </View>
  );
}

function AcaoIcone({
  icone,
  rotulo,
  cor,
  onPress,
}: {
  icone: keyof typeof MaterialIcons.glyphMap;
  rotulo: string;
  cor: string;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={Espaco.sm}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [styles.acao, pressed && styles.acaoPressionada]}
    >
      <MaterialIcons name={icone} size={16} color={cor} />
      <Text style={[Tipografia.botaoSm, { color: cor }]}>{rotulo}</Text>
    </Pressable>
  );
}

function GavetaPadroes({
  enderecoId,
  padroes,
  processando,
  onCriar,
  onExcluir,
}: {
  enderecoId: string;
  padroes: PadraoItem[] | undefined;
  processando: boolean;
  onCriar: GestaoEstruturaScreenProps['onCriarPadrao'];
  onExcluir: GestaoEstruturaScreenProps['onExcluirPadrao'];
}) {
  const [novo, setNovo] = useState('');
  const [erroGaveta, setErroGaveta] = useState<string | null>(null);

  if (!padroes) {
    return <ActivityIndicator color={Cores.primary} style={styles.carregandoGaveta} />;
  }

  return (
    <View style={styles.gaveta}>
      <Text style={[Tipografia.rotulo, styles.gavetaTitulo]}>Padrões Cemig</Text>

      {padroes.length === 0 ? (
        <Text style={[Tipografia.meta, styles.meta]}>Nenhum padrão cadastrado.</Text>
      ) : (
        padroes.map((padrao) => (
          <View key={padrao.padraoId} style={styles.padraoLinha}>
            <MaterialIcons name="speed" size={18} color={Cores.onSurfaceVariant} />
            <Text style={[Tipografia.corpoSm, styles.padraoNumero]}>{padrao.numero}</Text>
            <AcaoIcone
              icone="delete"
              rotulo="Remover"
              cor={Cores.error}
              onPress={async () => {
                setErroGaveta(null);
                const falha = await onExcluir(padrao.padraoId, enderecoId);
                if (falha) setErroGaveta(falha);
              }}
            />
          </View>
        ))
      )}

      <CampoTexto
        rotulo="Novo padrão"
        icone="speed"
        placeholder="Número do padrão"
        value={novo}
        onChangeText={(texto) => {
          setNovo(texto);
          setErroGaveta(null);
        }}
        keyboardType="number-pad"
      />

      {erroGaveta ? <Text style={styles.erro}>{erroGaveta}</Text> : null}

      <SolarButton
        titulo="Adicionar padrão"
        variante="fantasma"
        carregando={processando}
        onPress={async () => {
          setErroGaveta(null);
          const falha = await onCriar(enderecoId, novo);
          if (falha) {
            setErroGaveta(falha);
            return;
          }
          setNovo('');
        }}
      />
    </View>
  );
}

function ModalEmpresa({
  visivel,
  erro,
  salvando,
  onConfirmar,
  onFechar,
}: {
  visivel: boolean;
  erro: string | null;
  salvando: boolean;
  onConfirmar(nome: string, cnpj: string): Promise<void>;
  onFechar(): void;
}) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');

  return (
    <ModalShell
      visivel={visivel}
      icone="domain"
      titulo="Nova empresa"
      subtitulo="Cadastre uma empresa no sistema."
      erro={erro ?? undefined}
      confirmarLabel="Adicionar empresa"
      confirmando={salvando}
      onConfirmar={() => void onConfirmar(nome, cnpj)}
      onFechar={onFechar}
    >
      <CampoTexto
        rotulo="Nome da empresa"
        icone="business"
        placeholder="Ex.: Equinox Energia Solar"
        value={nome}
        onChangeText={setNome}
      />
      <CampoTexto
        rotulo="CNPJ"
        icone="badge"
        placeholder="00.000.000/0000-00"
        value={cnpj}
        onChangeText={setCnpj}
        keyboardType="number-pad"
      />
    </ModalShell>
  );
}

function ModalEndereco({
  modo,
  inicial,
  erro,
  salvando,
  onConfirmar,
  onFechar,
}: {
  modo: 'criar' | 'editar';
  inicial: EnderecoEstruturaDTO | null;
  erro: string | null;
  salvando: boolean;
  onConfirmar(campos: CamposEndereco, numerosDePadrao: string[]): Promise<void>;
  onFechar(): void;
}) {
  const [campos, setCampos] = useState<CamposEndereco>(
    inicial
      ? {
          apelido: inicial.apelido,
          uc: inicial.uc,
          ehUsina: inicial.ehUsina,
          // O DTO da lista não carrega rua/bairro separados; o logradouro
          // montado é só para exibição, então a edição parte dos vazios.
          rua: '',
          numero: '',
          bairro: '',
          cidade: '',
        }
      : CAMPOS_VAZIOS,
  );
  const [padroes, setPadroes] = useState('');

  const alterar = (campo: keyof CamposEndereco) => (valor: string) =>
    setCampos((atual) => ({ ...atual, [campo]: valor }));

  return (
    <ModalShell
      visivel
      icone={modo === 'criar' ? 'add-location-alt' : 'edit-location-alt'}
      titulo={modo === 'criar' ? 'Novo endereço' : 'Editar endereço'}
      subtitulo={
        modo === 'criar' ? 'Todo endereço precisa de ao menos um padrão Cemig.' : undefined
      }
      erro={erro ?? undefined}
      confirmarLabel={modo === 'criar' ? 'Adicionar endereço' : 'Salvar alterações'}
      confirmando={salvando}
      onConfirmar={() =>
        void onConfirmar(
          campos,
          padroes
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n !== ''),
        )
      }
      onFechar={onFechar}
    >
      <CampoTexto
        rotulo="Apelido do endereço"
        icone="label"
        placeholder="Ex.: Sede administrativa"
        value={campos.apelido}
        onChangeText={alterar('apelido')}
      />
      <CampoTexto
        rotulo="UC (unidade consumidora)"
        icone="tag"
        placeholder="Ex.: 3001234567"
        value={campos.uc}
        onChangeText={alterar('uc')}
        keyboardType="number-pad"
      />
      <CampoTexto
        rotulo="Rua (opcional)"
        icone="signpost"
        value={campos.rua ?? ''}
        onChangeText={alterar('rua')}
      />
      <CampoTexto
        rotulo="Número (opcional)"
        icone="pin"
        value={campos.numero ?? ''}
        onChangeText={alterar('numero')}
      />
      <CampoTexto
        rotulo="Bairro (opcional)"
        icone="holiday-village"
        value={campos.bairro ?? ''}
        onChangeText={alterar('bairro')}
      />
      <CampoTexto
        rotulo="Cidade (opcional)"
        icone="location-city"
        value={campos.cidade ?? ''}
        onChangeText={alterar('cidade')}
      />

      <View style={styles.toggle}>
        <View style={styles.toggleTextos}>
          <Text style={[Tipografia.corpoSm, styles.titulo]}>É uma usina?</Text>
          <Text style={[Tipografia.meta, styles.meta]}>
            Usina registra também a leitura de injeção.
          </Text>
        </View>
        <Switch
          value={campos.ehUsina ?? false}
          onValueChange={(valor) => setCampos((atual) => ({ ...atual, ehUsina: valor }))}
          trackColor={{ false: Cores.outlineVariant, true: Cores.primary }}
          thumbColor={Cores.onSurface}
        />
      </View>

      {modo === 'criar' ? (
        <CampoTexto
          rotulo="Padrões Cemig"
          icone="speed"
          placeholder="Ex.: 778811, 778812"
          value={padroes}
          onChangeText={setPadroes}
        />
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xl, gap: Espaco.md },
  topo: { gap: Espaco.md, marginBottom: Espaco.xs },
  carregando: { marginVertical: Espaco.xxxl },
  carregandoGaveta: { marginVertical: Espaco.lg },
  cartao: { gap: Espaco.sm },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.md },
  textos: { flex: 1, gap: 2 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
  titulo: { color: Cores.onSurface, flexShrink: 1 },
  meta: { color: Cores.onSurfaceVariant, lineHeight: 17 },
  acoes: {
    flexDirection: 'row',
    gap: Espaco.lg,
    marginTop: Espaco.xs,
    paddingTop: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
  acao: { flexDirection: 'row', alignItems: 'center', gap: Espaco.xs, minHeight: 32 },
  acaoPressionada: { opacity: 0.6 },
  gaveta: {
    gap: Espaco.md,
    marginTop: Espaco.sm,
    paddingTop: Espaco.md,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
  gavetaTitulo: { color: Cores.onSurfaceVariant, opacity: 0.7 },
  padraoLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  padraoNumero: { flex: 1, color: Cores.onSurface, fontWeight: '600' },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  toggleTextos: { flex: 1, gap: 2 },
});
