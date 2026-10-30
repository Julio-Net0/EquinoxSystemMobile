import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Cores, Espaco, Overlay, Raio } from '@/constants/theme';

export type NivelSuperficie = 'baixo' | 'base' | 'alto';

export interface CartaoProps {
  children: ReactNode;
  nivel?: NivelSuperficie;
  onPress?: () => void;
  /** Contorna em âmbar: usado em item selecionado ou que pede atenção. */
  destacado?: boolean;
  style?: ViewStyle;
}

const FUNDOS: Record<NivelSuperficie, string> = {
  baixo: Cores.surfaceContainerLow,
  base: Cores.surfaceContainer,
  alto: Cores.surfaceContainerHigh,
};

/** Card de lista do app antigo: raio 16, borda branca a 5%. */
export function Cartao({ children, nivel = 'base', onPress, destacado, style }: CartaoProps) {
  const estilos = [
    styles.base,
    { backgroundColor: FUNDOS[nivel] },
    destacado && styles.destacado,
    style,
  ];

  if (!onPress) return <View style={estilos}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: Overlay.bordaForte }}
      style={({ pressed }) => [...estilos, pressed && styles.pressionado]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Overlay.borda,
    padding: Espaco.lg,
    overflow: 'hidden',
  },
  destacado: { borderColor: Overlay.primaryBorda },
  // Card encolhe 1% no toque, menos que o botão: é uma superfície maior.
  pressionado: { transform: [{ scale: 0.99 }] },
});
