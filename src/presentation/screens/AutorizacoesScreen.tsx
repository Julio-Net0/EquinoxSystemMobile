import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Tipografia } from '@/constants/theme';
import { PerfilEnum, rotuloDoPerfil } from '@/domain/enums/PerfilEnum';
import { UsuarioResumoDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { Cartao } from '@/presentation/components/Cartao';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { FiltroChips } from '@/presentation/components/FiltroChips';
import { ItemSelecionavel } from '@/presentation/components/SeletorBusca';
import { SeletorMultiploSheet } from '@/presentation/components/SeletorMultiploSheet';
import { SolarButton } from '@/presentation/components/SolarButton';
import { PilulaStatus } from '@/presentation/components/PilulaStatus';

export interface AutorizacoesScreenProps {
  pendentes: UsuarioResumoDTO[];
  enderecos: ItemSelecionavel[];
  carregando: boolean;
  erro: string | null;
  processandoId: string | null;
  /** Super admin pode conceder o próprio nível; administrador não. */
  podeConcederSuperAdmin: boolean;
  onAutorizar(usuarioId: string, perfil: PerfilEnum, enderecoIds: string[]): Promise<string | null>;
  onRecusar(usuarioId: string): Promise<string | null>;
  onVoltar(): void;
}

/** Aprovar cadastros, portada de example/Equinox.MOBILE/src/pages/admin.ts. */
export function AutorizacoesScreen({
  pendentes,
  enderecos,
  carregando,
  erro,
  processandoId,
  podeConcederSuperAdmin,
  onAutorizar,
  onRecusar,
  onVoltar,
}: AutorizacoesScreenProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo="Aprovar cadastros"
        subtitulo={pendentes.length > 0 ? `${pendentes.length} aguardando` : undefined}
        onVoltar={onVoltar}
      />

      <FlatList
        data={pendentes}
        keyExtractor={(item) => item.usuarioId}
        contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
        ListHeaderComponent={
          erro ? (
            <Cartao nivel="baixo">
              <Text style={styles.erro}>{erro}</Text>
            </Cartao>
          ) : null
        }
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator color={Cores.primary} style={styles.carregando} />
          ) : (
            <EstadoVazio
              icone="inbox"
              titulo="Nenhum cadastro aguardando"
              descricao="Novas solicitações aparecem aqui."
            />
          )
        }
        renderItem={({ item }) => (
          <CartaoPendente
            usuario={item}
            enderecos={enderecos}
            processando={processandoId === item.usuarioId}
            podeConcederSuperAdmin={podeConcederSuperAdmin}
            onAutorizar={onAutorizar}
            onRecusar={onRecusar}
          />
        )}
      />
    </View>
  );
}

function CartaoPendente({
  usuario,
  enderecos,
  processando,
  podeConcederSuperAdmin,
  onAutorizar,
  onRecusar,
}: {
  usuario: UsuarioResumoDTO;
  enderecos: ItemSelecionavel[];
  processando: boolean;
  podeConcederSuperAdmin: boolean;
  onAutorizar: AutorizacoesScreenProps['onAutorizar'];
  onRecusar: AutorizacoesScreenProps['onRecusar'];
}) {
  const [perfil, setPerfil] = useState<PerfilEnum>(PerfilEnum.TECNICO);
  const [vinculos, setVinculos] = useState<string[]>([]);
  const [erroCartao, setErroCartao] = useState<string | null>(null);

  const perfisDisponiveis: PerfilEnum[] = podeConcederSuperAdmin
    ? [PerfilEnum.TECNICO, PerfilEnum.ADMIN, PerfilEnum.SUPER_ADMIN]
    : [PerfilEnum.TECNICO, PerfilEnum.ADMIN];

  // Super admin tem escopo global, então não precisa de endereço vinculado.
  const exigeEndereco = perfil !== PerfilEnum.SUPER_ADMIN;

  const autorizar = async () => {
    setErroCartao(null);
    const falha = await onAutorizar(usuario.usuarioId, perfil, exigeEndereco ? vinculos : []);
    if (falha) setErroCartao(falha);
  };

  const recusar = async () => {
    setErroCartao(null);
    const falha = await onRecusar(usuario.usuarioId);
    if (falha) setErroCartao(falha);
  };

  return (
    <Cartao>
      <View style={styles.cartaoConteudo}>
        <View style={styles.cabecalho}>
          <View style={styles.identidade}>
            <Text style={[Tipografia.tituloCard, styles.nome]} numberOfLines={1}>
              {usuario.nome}
            </Text>
            <Text style={[Tipografia.meta, styles.meta]} numberOfLines={1}>
              @{usuario.usuario} · {usuario.email}
            </Text>
          </View>
          <PilulaStatus texto="Pendente" tom="primary" />
        </View>

        <View style={styles.campo}>
          <Text style={[Tipografia.rotulo, styles.rotulo]}>Perfil de acesso</Text>
          <FiltroChips
            opcoes={perfisDisponiveis.map((p) => ({ valor: p, rotulo: rotuloDoPerfil(p) }))}
            selecionado={perfil}
            onSelecionar={(novo) => {
              setPerfil(novo);
              setErroCartao(null);
            }}
          />
        </View>

        {exigeEndereco ? (
          <SeletorMultiploSheet
            rotulo="Vincular endereços"
            itens={enderecos}
            selecionados={vinculos}
            onChange={(ids) => {
              setVinculos(ids);
              setErroCartao(null);
            }}
            textoVazio="Nenhum endereço cadastrado ainda."
          />
        ) : (
          <Text style={[Tipografia.meta, styles.meta]}>
            Super admin tem acesso a todas as empresas e não precisa de vínculo.
          </Text>
        )}

        {erroCartao ? <Text style={styles.erro}>{erroCartao}</Text> : null}

        <View style={styles.acoes}>
          <SolarButton titulo="Autorizar" carregando={processando} onPress={autorizar} />
          <SolarButton titulo="Recusar" variante="perigo" onPress={recusar} />
        </View>
      </View>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xl, gap: Espaco.md },
  carregando: { marginVertical: Espaco.xxxl },
  cartaoConteudo: { gap: Espaco.lg },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.sm },
  identidade: { flex: 1, gap: 2 },
  nome: { color: Cores.onSurface },
  meta: { color: Cores.onSurfaceVariant },
  campo: { gap: Espaco.sm },
  rotulo: { color: Cores.onSurfaceVariant, opacity: 0.7, marginLeft: Espaco.xs },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  acoes: { gap: Espaco.sm },
});
