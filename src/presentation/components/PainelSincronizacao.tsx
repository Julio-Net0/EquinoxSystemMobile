import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { isoComOffset } from '@/domain/value-objects/InstanteBrasilia';
import { SolarButton } from './SolarButton';

export interface PainelSincronizacaoProps {
  online: boolean;
  sincronizando: boolean;
  pendentes: number;
  isolados: number;
  ultimaSincronizacaoEm: string | null;
  aviso: string | null;
  onSincronizar(): void;
  onTentarDeNovo(): void;
}

type Tom = 'ok' | 'atencao' | 'erro' | 'neutro';

const TONS: Record<Tom, { cor: string; fundo: string; borda: string }> = {
  ok: { cor: Cores.sucesso, fundo: Overlay.sucessoFraco, borda: Overlay.sucessoBorda },
  atencao: { cor: Cores.primary, fundo: Overlay.primaryFraco, borda: Overlay.primaryBorda },
  erro: { cor: Cores.error, fundo: Overlay.errorFraco, borda: Overlay.errorBorda },
  neutro: { cor: Cores.onSurfaceVariant, fundo: Overlay.borda, borda: Overlay.bordaForte },
};

/** "10/03/2026 às 12:00", no horário de Brasília e sem depender de Intl. */
export function formatarInstante(iso: string): string {
  const local = isoComOffset(new Date(iso));
  const [ano, mes, dia] = local.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano} às ${local.slice(11, 16)}`;
}

const plural = (n: number, um: string, varios: string): string => (n === 1 ? um : varios);

/**
 * Resumo da situação do aparelho em relação à nuvem, numa frase. A ordem dos
 * testes é a ordem do que mais importa ao técnico saber.
 */
export function resumoDaSincronizacao(
  p: Pick<PainelSincronizacaoProps, 'online' | 'sincronizando' | 'pendentes' | 'isolados'>,
): { titulo: string; icone: keyof typeof MaterialIcons.glyphMap; tom: Tom } {
  if (p.sincronizando) {
    return { titulo: 'Sincronizando…', icone: 'sync', tom: 'atencao' };
  }
  if (p.isolados > 0) {
    return {
      titulo: `${p.isolados} ${plural(p.isolados, 'item não pôde', 'itens não puderam')} ser enviado${plural(p.isolados, '', 's')}`,
      icone: 'sync-problem',
      tom: 'erro',
    };
  }
  if (!p.online) {
    return {
      titulo:
        p.pendentes > 0
          ? `Offline · ${p.pendentes} ${plural(p.pendentes, 'item pendente', 'itens pendentes')} de envio`
          : 'Offline · trabalhando sem conexão',
      icone: 'cloud-off',
      tom: 'neutro',
    };
  }
  if (p.pendentes > 0) {
    return {
      titulo: `${p.pendentes} ${plural(p.pendentes, 'item pendente', 'itens pendentes')} de envio`,
      icone: 'cloud-upload',
      tom: 'atencao',
    };
  }
  return { titulo: 'Tudo sincronizado', icone: 'cloud-done', tom: 'ok' };
}

/**
 * Estado da conexão e da fila de envio, com o botão de sincronização manual.
 *
 * É a resposta visível à pergunta "isto que eu registrei já subiu?": mostra se
 * há rede, quantos itens ainda estão só no aparelho, quando foi a última
 * sincronização e o que deu errado, em linguagem de técnico.
 */
export function PainelSincronizacao(props: PainelSincronizacaoProps) {
  const { online, sincronizando, isolados, ultimaSincronizacaoEm, aviso } = props;
  const resumo = resumoDaSincronizacao(props);
  const tom = TONS[resumo.tom];

  return (
    <View
      style={[styles.raiz, { backgroundColor: tom.fundo, borderColor: tom.borda }]}
      testID="painel-sincronizacao"
    >
      <View style={styles.topo}>
        <MaterialIcons name={resumo.icone} size={22} color={tom.cor} />
        <View style={styles.textos}>
          <Text style={[Tipografia.tituloCard, { color: tom.cor }]} testID="sync-titulo">
            {resumo.titulo}
          </Text>
          <Text style={[Tipografia.meta, styles.meta]} testID="sync-ultima">
            {ultimaSincronizacaoEm
              ? `Última sincronização: ${formatarInstante(ultimaSincronizacaoEm)}`
              : 'Ainda não sincronizou neste aparelho'}
          </Text>
        </View>
      </View>

      {aviso ? (
        <Text style={[Tipografia.corpoSm, styles.aviso]} testID="sync-aviso">
          {aviso}
        </Text>
      ) : null}

      <View style={styles.acoes}>
        <SolarButton
          titulo={online ? 'Sincronizar agora' : 'Sem conexão'}
          variante="secundario"
          icone="sync"
          carregando={sincronizando}
          disabled={!online}
          onPress={props.onSincronizar}
          testID="botao-sincronizar"
        />
        {isolados > 0 ? (
          <SolarButton
            titulo="Tentar de novo"
            variante="fantasma"
            icone="refresh"
            disabled={!online || sincronizando}
            onPress={props.onTentarDeNovo}
            testID="botao-tentar-de-novo"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    borderWidth: 1,
    borderRadius: Raio.lg,
    padding: Espaco.lg,
    gap: Espaco.md,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  textos: { flex: 1, gap: 2 },
  meta: { color: Cores.onSurfaceVariant },
  aviso: { color: Cores.onSurface, lineHeight: 20 },
  acoes: { gap: Espaco.sm },
});
