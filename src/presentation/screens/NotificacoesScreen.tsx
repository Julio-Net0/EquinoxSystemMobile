import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { NotificacaoDTO } from '@/application/use-cases/GerenciarNotificacoesUseCase';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { Cartao } from '@/presentation/components/Cartao';
import { IconeTile } from '@/presentation/components/IconeTile';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface NotificacoesScreenProps {
  notificacoes: NotificacaoDTO[];
  temMais: boolean;
  carregando: boolean;
  erro: string | null;
  decidindoId: string | null;
  onCarregarMais(): void;
  onMarcarLida(id: string): void;
  onMarcarTodasLidas(): void;
  onDecidir(id: string, decisao: 'aprovar' | 'descartar'): void;
}

const ICONES: Record<TipoNotificacaoEnum, keyof typeof MaterialIcons.glyphMap> = {
  [TipoNotificacaoEnum.LEITURA_ATRASADA]: 'schedule',
  [TipoNotificacaoEnum.LEITURA_SUBSTITUIDA]: 'swap-horiz',
  [TipoNotificacaoEnum.LEITURA_VALOR_MENOR]: 'trending-down',
  [TipoNotificacaoEnum.LEITURA_FORA_DE_RAIO]: 'wrong-location',
  [TipoNotificacaoEnum.LEITURA_SEM_GPS]: 'gps-off',
  [TipoNotificacaoEnum.CADASTRO_PENDENTE]: 'person-add',
};

const ROTULO_RESOLUCAO: Record<ResolucaoEnum, string> = {
  [ResolucaoEnum.APROVADA]: 'Aprovada',
  [ResolucaoEnum.DESCARTADA]: 'Descartada',
  [ResolucaoEnum.AUTOMATICA]: 'Resolvida automaticamente',
};

/** Data e hora em pt-BR, tolerante a valor inválido vindo do banco. */
function formatarQuando(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;

  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const mi = String(data.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${data.getFullYear()} ${hh}:${mi}`;
}

/**
 * Central de notificações do administrador, portada de
 * example/Equinox.MOBILE/src/pages/notificacoes.ts.
 *
 * Diferença do original: "enviar para a planilha" virou "aprovar". Offline não
 * existe planilha, e o botão antigo prometeria algo que não acontece.
 */
export function NotificacoesScreen({
  notificacoes,
  temMais,
  carregando,
  erro,
  decidindoId,
  onCarregarMais,
  onMarcarLida,
  onMarcarTodasLidas,
  onDecidir,
}: NotificacoesScreenProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo="Notificações"
        acao={
          notificacoes.length > 0 ? (
            <Pressable
              onPress={onMarcarTodasLidas}
              hitSlop={Espaco.sm}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas como lidas"
            >
              <MaterialIcons name="done-all" size={22} color={Cores.onSurfaceVariant} />
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={notificacoes}
        keyExtractor={(item) => item.notificacaoId}
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
              titulo="Nenhuma notificação"
              descricao="Avisos de leitura aparecem aqui."
            />
          )
        }
        ListFooterComponent={
          temMais ? (
            <View style={styles.rodape}>
              <SolarButton
                titulo="Carregar mais"
                variante="fantasma"
                carregando={carregando}
                onPress={onCarregarMais}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Cartao
            nivel={item.lida ? 'baixo' : 'base'}
            destacado={!item.lida}
            onPress={item.lida ? undefined : () => onMarcarLida(item.notificacaoId)}
          >
            <View style={styles.linha}>
              <IconeTile icone={ICONES[item.tipo] ?? 'notifications'} tamanho={40} />

              <View style={styles.textos}>
                <View style={styles.cabecalho}>
                  <Text style={[Tipografia.tituloCard, styles.titulo]} numberOfLines={2}>
                    {item.titulo}
                  </Text>
                  {!item.lida ? <View style={styles.ponto} /> : null}
                </View>

                <Text style={[Tipografia.meta, styles.quando]}>{formatarQuando(item.criadaEm)}</Text>

                <Text style={[Tipografia.corpoSm, styles.mensagem]}>{item.mensagem}</Text>

                {item.resolucao ? (
                  <Text style={[Tipografia.meta, styles.resolucao]}>
                    {ROTULO_RESOLUCAO[item.resolucao]}
                    {item.resolvidaEm ? ` em ${formatarQuando(item.resolvidaEm)}` : ''}
                  </Text>
                ) : null}

                {item.aguardandoDecisao ? (
                  <View style={styles.acoes}>
                    <SolarButton
                      titulo="Aprovar"
                      carregando={decidindoId === item.notificacaoId}
                      onPress={() => onDecidir(item.notificacaoId, 'aprovar')}
                    />
                    <SolarButton
                      titulo="Descartar"
                      variante="perigo"
                      onPress={() => onDecidir(item.notificacaoId, 'descartar')}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </Cartao>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xl, gap: Espaco.md },
  carregando: { marginVertical: Espaco.xxxl },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.md },
  textos: { flex: 1, gap: 2 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
  titulo: { color: Cores.onSurface, flex: 1 },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: Raio.pilula,
    backgroundColor: Cores.primary,
  },
  quando: { color: Cores.onSurfaceVariant },
  mensagem: { color: Cores.onSurfaceVariant, marginTop: Espaco.xs, lineHeight: 20 },
  resolucao: {
    color: Cores.onSurfaceVariant,
    marginTop: Espaco.sm,
    paddingTop: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
  acoes: { gap: Espaco.sm, marginTop: Espaco.md },
  rodape: { paddingTop: Espaco.lg },
});
