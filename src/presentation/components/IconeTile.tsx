import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Cores, Overlay, Raio } from '@/constants/theme';

export type TomTile = 'primary' | 'erro' | 'sucesso' | 'neutro';

export interface IconeTileProps {
  icone: keyof typeof MaterialIcons.glyphMap;
  tamanho?: number;
  tom?: TomTile;
}

const TONS: Record<TomTile, { fundo: string; borda: string; icone: string }> = {
  primary: { fundo: Overlay.primaryFraco, borda: Overlay.primaryBorda, icone: Cores.primary },
  erro: { fundo: Overlay.errorFraco, borda: Overlay.errorBorda, icone: Cores.error },
  sucesso: { fundo: Overlay.sucessoFraco, borda: Overlay.sucessoBorda, icone: Cores.sucesso },
  neutro: { fundo: Overlay.borda, borda: Overlay.bordaForte, icone: Cores.onSurfaceVariant },
};

/**
 * Quadrado arredondado com ícone ao centro, usado à esquerda dos cards. O raio
 * acompanha o tamanho para o tile não ficar nem quadrado nem redondo demais.
 */
export function IconeTile({ icone, tamanho = 44, tom = 'primary' }: IconeTileProps) {
  const cores = TONS[tom];

  return (
    <View
      style={[
        styles.base,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho >= 56 ? Raio.xl : Raio.md,
          backgroundColor: cores.fundo,
          borderColor: cores.borda,
        },
      ]}
    >
      <MaterialIcons name={icone} size={Math.round(tamanho * 0.5)} color={cores.icone} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
});
