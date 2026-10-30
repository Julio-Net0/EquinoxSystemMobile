import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { ALVO_TOQUE, Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma';

export interface SolarButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  titulo: string;
  variante?: VarianteBotao;
  carregando?: boolean;
  icone?: keyof typeof MaterialIcons.glyphMap;
  /** Ocupa a largura disponível. Padrão: true. */
  largo?: boolean;
}

/**
 * Botão da identidade Equinox. O primário é o gradiente âmbar de 135° com texto
 * preto e brilho, portado do `.solar-gradient-btn` do app antigo.
 */
export function SolarButton({
  titulo,
  variante = 'primario',
  carregando = false,
  icone,
  largo = true,
  disabled,
  ...resto
}: SolarButtonProps) {
  const inativo = disabled || carregando;
  const corDoTexto = variante === 'primario' ? '#000000' : CORES_DE_TEXTO[variante];

  const conteudo = carregando ? (
    <ActivityIndicator color={corDoTexto} />
  ) : (
    <View style={styles.conteudo}>
      {icone ? <MaterialIcons name={icone} size={18} color={corDoTexto} /> : null}
      <Text style={[Tipografia.botao, { color: corDoTexto }]} numberOfLines={1}>
        {titulo}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo, busy: carregando }}
      disabled={inativo}
      style={({ pressed }) => [
        styles.base,
        largo && styles.largo,
        variante !== 'primario' && estilosDeVariante[variante],
        // Feedback de toque do app antigo: o botão encolhe 2%.
        pressed && !inativo && styles.pressionado,
        inativo && styles.inativo,
      ]}
      {...resto}
    >
      {variante === 'primario' ? (
        <LinearGradient
          colors={[Cores.primary, Cores.primaryDim]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradiente}
        >
          {conteudo}
        </LinearGradient>
      ) : (
        conteudo
      )}
    </Pressable>
  );
}

const CORES_DE_TEXTO: Record<VarianteBotao, string> = {
  primario: '#000000',
  secundario: Cores.primary,
  perigo: Cores.error,
  fantasma: Cores.onSurfaceVariant,
};

const estilosDeVariante = StyleSheet.create({
  secundario: {
    backgroundColor: Overlay.primaryFraco,
    borderWidth: 1,
    borderColor: Overlay.primaryBorda,
    paddingVertical: Espaco.lg,
    paddingHorizontal: Espaco.xl,
  },
  perigo: {
    backgroundColor: Overlay.errorFraco,
    borderWidth: 1,
    borderColor: Overlay.errorBorda,
    paddingVertical: Espaco.lg,
    paddingHorizontal: Espaco.xl,
  },
  fantasma: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Overlay.bordaForte,
    paddingVertical: Espaco.lg,
    paddingHorizontal: Espaco.xl,
  },
});

const styles = StyleSheet.create({
  base: {
    minHeight: ALVO_TOQUE,
    borderRadius: Raio.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largo: { alignSelf: 'stretch' },
  gradiente: {
    width: '100%',
    paddingVertical: Espaco.lg,
    paddingHorizontal: Espaco.xl,
    alignItems: 'center',
    justifyContent: 'center',
    // Brilho âmbar do botão principal. boxShadow em vez das props shadow*,
    // que estão depreciadas no React Native 0.76+ e avisam a cada render.
    boxShadow: `0px 0px 15px ${Overlay.brilhoPrimary}`,
  },
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.sm,
  },
  pressionado: { transform: [{ scale: 0.98 }] },
  inativo: { opacity: 0.5 },
});
