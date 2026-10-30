import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Tipografia } from '@/constants/theme';
import { PerfilEnum, rotuloDoPerfil } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { UsuarioResumoDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { DadosEdicaoUsuario, FiltroStatus } from '@/presentation/hooks/useGestaoUsuarios';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { CampoTexto } from '@/presentation/components/CampoTexto';
import { Cartao } from '@/presentation/components/Cartao';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { FiltroChips } from '@/presentation/components/FiltroChips';
import { ModalShell } from '@/presentation/components/ModalShell';
import { PilulaStatusUsuario, PilulaPerfil } from '@/presentation/components/PilulaStatus';
import { ItemSelecionavel } from '@/presentation/components/SeletorBusca';
import { SeletorMultiploSheet } from '@/presentation/components/SeletorMultiploSheet';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface GestaoUsuariosScreenProps {
  usuarios: UsuarioResumoDTO[];
  enderecos: ItemSelecionavel[];
  filtro: FiltroStatus;
  busca: string;
  carregando: boolean;
  erro: string | null;
  processandoId: string | null;
  podeConcederSuperAdmin: boolean;
  onFiltro(filtro: FiltroStatus): void;
  onBusca(termo: string): void;
  onSalvar(usuarioId: string, dados: DadosEdicaoUsuario): Promise<string | null>;
  onAlternarStatus(usuarioId: string): Promise<string | null>;
  onAprovarRapido(usuarioId: string): Promise<string | null>;
  onExcluir(usuarioId: string): Promise<string | null>;
  onVoltar(): void;
}

const FILTROS: { valor: FiltroStatus; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: StatusUsuarioEnum.PENDENTE, rotulo: 'Pendentes' },
  { valor: StatusUsuarioEnum.ATIVO, rotulo: 'Ativos' },
  { valor: StatusUsuarioEnum.RECUSADO, rotulo: 'Recusados' },
  { valor: StatusUsuarioEnum.INATIVO, rotulo: 'Inativos' },
];

/** Gerenciar usuários, portada de example/Equinox.MOBILE/src/pages/usuarios.ts. */
export function GestaoUsuariosScreen(props: GestaoUsuariosScreenProps) {
  const {
    usuarios, enderecos, filtro, busca, carregando, erro, processandoId,
    podeConcederSuperAdmin, onFiltro, onBusca, onSalvar, onAlternarStatus,
    onAprovarRapido, onExcluir, onVoltar,
  } = props;

  const { bottom } = useSafeAreaInsets();
  const [editando, setEditando] = useState<UsuarioResumoDTO | null>(null);
  const [excluindo, setExcluindo] = useState<UsuarioResumoDTO | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);

  return (
    <View style={styles.raiz}>
      <CabecalhoTela titulo="Usuários" onVoltar={onVoltar} />

      <FlatList
        data={usuarios}
        keyExtractor={(item) => item.usuarioId}
        contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
        ListHeaderComponent={
          <View style={styles.filtros}>
            <CampoTexto
              rotulo="Buscar"
              icone="search"
              placeholder="Nome, e-mail ou usuário"
              value={busca}
              onChangeText={onBusca}
              autoCapitalize="none"
            />
            <FiltroChips opcoes={FILTROS} selecionado={filtro} onSelecionar={onFiltro} />
            {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator color={Cores.primary} style={styles.carregando} />
          ) : (
            <EstadoVazio icone="person-off" titulo="Nenhum usuário encontrado" />
          )
        }
        renderItem={({ item }) => (
          <Cartao>
            <View style={styles.cartao}>
              <View style={styles.cabecalho}>
                <View style={styles.identidade}>
                  <Text style={[Tipografia.tituloCard, styles.nome]} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={[Tipografia.meta, styles.meta]} numberOfLines={1}>
                    @{item.usuario} · {item.email}
                  </Text>
                </View>
                <PilulaStatusUsuario status={item.status} />
              </View>

              <View style={styles.pilulas}>
                <PilulaPerfil perfil={item.perfil} />
              </View>

              <Text style={[Tipografia.meta, styles.meta]}>
                {item.enderecos.length === 0
                  ? item.perfil === PerfilEnum.SUPER_ADMIN
                    ? 'Acesso global'
                    : 'Nenhum endereço vinculado'
                  : item.enderecos.map((e) => `${e.apelido} · UC ${e.uc}`).join('  |  ')}
              </Text>

              <View style={styles.acoes}>
                {/* Reaprovação em um toque, como o atalho do app antigo. */}
                {item.status === StatusUsuarioEnum.RECUSADO ? (
                  <AcaoTexto
                    icone="check-circle"
                    rotulo="Aprovar"
                    cor={Cores.sucesso}
                    carregando={processandoId === item.usuarioId}
                    onPress={async () => {
                      const falha = await onAprovarRapido(item.usuarioId);
                      if (falha) setErroModal(falha);
                    }}
                  />
                ) : null}

                <AcaoTexto
                  icone={item.status === StatusUsuarioEnum.ATIVO ? 'pause-circle' : 'play-circle'}
                  rotulo={item.status === StatusUsuarioEnum.ATIVO ? 'Desativar' : 'Ativar'}
                  cor={Cores.onSurfaceVariant}
                  carregando={processandoId === item.usuarioId}
                  onPress={async () => {
                    const falha = await onAlternarStatus(item.usuarioId);
                    if (falha) setErroModal(falha);
                  }}
                />

                <AcaoTexto
                  icone="edit"
                  rotulo="Editar"
                  cor={Cores.primary}
                  onPress={() => {
                    setErroModal(null);
                    setEditando(item);
                  }}
                />

                <AcaoTexto
                  icone="delete"
                  rotulo="Excluir"
                  cor={Cores.error}
                  onPress={() => {
                    setErroModal(null);
                    setExcluindo(item);
                  }}
                />
              </View>
            </View>
          </Cartao>
        )}
      />

      {editando ? (
        <ModalEdicao
          usuario={editando}
          enderecos={enderecos}
          podeConcederSuperAdmin={podeConcederSuperAdmin}
          erro={erroModal}
          salvando={processandoId === editando.usuarioId}
          onSalvar={async (dados) => {
            const falha = await onSalvar(editando.usuarioId, dados);
            if (falha) {
              setErroModal(falha);
              return;
            }
            setEditando(null);
          }}
          onFechar={() => setEditando(null)}
        />
      ) : null}

      <ModalShell
        visivel={excluindo !== null}
        tema="erro"
        icone="delete"
        titulo="Excluir usuário?"
        subtitulo={
          excluindo
            ? `${excluindo.nome} (@${excluindo.usuario}) perderá o acesso ao app.`
            : undefined
        }
        erro={erroModal ?? undefined}
        confirmarLabel="Excluir"
        cancelarLabel="Voltar"
        confirmando={excluindo !== null && processandoId === excluindo.usuarioId}
        onConfirmar={async () => {
          if (!excluindo) return;
          const falha = await onExcluir(excluindo.usuarioId);
          if (falha) {
            setErroModal(falha);
            return;
          }
          setExcluindo(null);
        }}
        onFechar={() => setExcluindo(null)}
      />
    </View>
  );
}

function AcaoTexto({
  icone,
  rotulo,
  cor,
  carregando = false,
  onPress,
}: {
  icone: keyof typeof MaterialIcons.glyphMap;
  rotulo: string;
  cor: string;
  carregando?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={carregando}
      hitSlop={Espaco.sm}
      accessibilityRole="button"
      style={({ pressed }) => [styles.acao, pressed && styles.acaoPressionada]}
    >
      <MaterialIcons name={icone} size={16} color={cor} />
      <Text style={[Tipografia.botaoSm, { color: cor }]}>{rotulo}</Text>
    </Pressable>
  );
}

function ModalEdicao({
  usuario,
  enderecos,
  podeConcederSuperAdmin,
  erro,
  salvando,
  onSalvar,
  onFechar,
}: {
  usuario: UsuarioResumoDTO;
  enderecos: ItemSelecionavel[];
  podeConcederSuperAdmin: boolean;
  erro: string | null;
  salvando: boolean;
  onSalvar(dados: DadosEdicaoUsuario): Promise<void>;
  onFechar(): void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [perfil, setPerfil] = useState(usuario.perfil);
  const [status, setStatus] = useState(usuario.status);
  const [vinculos, setVinculos] = useState<string[]>(usuario.enderecoIds);

  const perfis = podeConcederSuperAdmin
    ? [PerfilEnum.TECNICO, PerfilEnum.ADMIN, PerfilEnum.SUPER_ADMIN]
    : [PerfilEnum.TECNICO, PerfilEnum.ADMIN];

  const statusPossiveis = [
    StatusUsuarioEnum.ATIVO,
    StatusUsuarioEnum.PENDENTE,
    StatusUsuarioEnum.RECUSADO,
    StatusUsuarioEnum.INATIVO,
  ];

  return (
    <ModalShell
      visivel
      icone="edit"
      titulo="Editar usuário"
      subtitulo={`@${usuario.usuario}`}
      erro={erro ?? undefined}
      confirmarLabel="Salvar alterações"
      confirmando={salvando}
      onConfirmar={() => void onSalvar({ nome, email, perfil, status, enderecoIds: vinculos })}
      onFechar={onFechar}
    >
      <CampoTexto rotulo="Nome" icone="person" value={nome} onChangeText={setNome} />
      <CampoTexto
        rotulo="E-mail"
        icone="mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={styles.campoModal}>
        <Text style={[Tipografia.rotulo, styles.rotuloModal]}>Perfil de acesso</Text>
        <FiltroChips<PerfilEnum>
          opcoes={perfis.map((p) => ({ valor: p, rotulo: rotuloDoPerfil(p) }))}
          selecionado={perfil}
          onSelecionar={setPerfil}
        />
      </View>

      <View style={styles.campoModal}>
        <Text style={[Tipografia.rotulo, styles.rotuloModal]}>Status</Text>
        <FiltroChips<StatusUsuarioEnum>
          opcoes={statusPossiveis.map((s) => ({ valor: s, rotulo: s }))}
          selecionado={status}
          onSelecionar={setStatus}
        />
      </View>

      {perfil === PerfilEnum.SUPER_ADMIN ? (
        <Text style={[Tipografia.meta, styles.meta]}>
          Super admin tem acesso global e não precisa de endereço vinculado.
        </Text>
      ) : (
        <SeletorMultiploSheet
          rotulo="Endereços vinculados"
          itens={enderecos}
          selecionados={vinculos}
          onChange={setVinculos}
          textoVazio="Nenhum endereço cadastrado para esta empresa."
        />
      )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xl, gap: Espaco.md },
  filtros: { gap: Espaco.lg, marginBottom: Espaco.xs },
  carregando: { marginVertical: Espaco.xxxl },
  cartao: { gap: Espaco.sm },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.sm },
  identidade: { flex: 1, gap: 2 },
  nome: { color: Cores.onSurface },
  meta: { color: Cores.onSurfaceVariant, lineHeight: 17 },
  pilulas: { flexDirection: 'row', gap: Espaco.sm },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.lg,
    marginTop: Espaco.sm,
  },
  acao: { flexDirection: 'row', alignItems: 'center', gap: Espaco.xs, minHeight: 32 },
  acaoPressionada: { opacity: 0.6 },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  campoModal: { gap: Espaco.sm },
  rotuloModal: { color: Cores.onSurfaceVariant, opacity: 0.7, marginLeft: Espaco.xs },
});
