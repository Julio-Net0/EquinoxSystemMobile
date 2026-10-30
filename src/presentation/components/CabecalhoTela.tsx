import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALVO_TOQUE, Cores, Espaco, Overlay, Tipografia } from '@/constants/theme';

export interface CabecalhoTelaProps {
  titulo: string;
  subtitulo?: string;
  onVoltar?: () => void;
  acao?: ReactNode;
}

/**
 * Cabeçalho fixo do app antigo. Respeita a área segura do topo: no Android com
 * barra de status translúcida e no iPhone com notch, o título ficaria embaixo
 * do sistema sem isso.
 */
export function CabecalhoTela({ titulo, subtitulo, onVoltar, acao }: CabecalhoTelaProps) {
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.base, { paddingTop: top + Espaco.md }]}>
      {onVoltar ? (
        <Pressable
          onPress={onVoltar}
          hitSlop={Espaco.sm}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.botaoVoltar}
        >
          <MaterialIcons name="arrow-back" size={24} color={Cores.onSurface} />
        </Pressable>
      ) : null}

      <View style={styles.centro}>
        <Text style={[Tipografia.titulo, styles.titulo]} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[Tipografia.meta, styles.subtitulo]} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>

      {/* Espaço reservado mesmo sem ação, para o título não sair do centro. */}
      <View style={styles.direita}>{acao}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    paddingHorizontal: Espaco.xl,
    paddingBottom: Espaco.md,
    backgroundColor: Cores.surface,
    borderBottomWidth: 1,
    borderBottomColor: Overlay.borda,
  },
  botaoVoltar: {
    width: ALVO_TOQUE,
    height: ALVO_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Espaco.md,
  },
  centro: { flex: 1 },
  titulo: { color: Cores.onSurface },
  subtitulo: { color: Cores.onSurfaceVariant, marginTop: 2 },
  direita: { minWidth: ALVO_TOQUE, alignItems: 'flex-end' },
});
