import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  ALVO_TOQUE,
  Cores,
  Espaco,
  Overlay,
  Raio,
  TAMANHO_MINIMO_INPUT,
  Tipografia,
} from '@/constants/theme';

export interface CampoTextoProps extends Omit<TextInputProps, 'style'> {
  rotulo: string;
  erro?: string;
  icone?: keyof typeof MaterialIcons.glyphMap;
  /** Mostra o olho de revelar senha. */
  segredo?: boolean;
}

/**
 * Campo de borda inferior do app antigo: rótulo em caixa alta pequeno acima,
 * linha que acende em âmbar no foco e vira vermelha no erro.
 */
export function CampoTexto({ rotulo, erro, icone, segredo = false, ...resto }: CampoTextoProps) {
  const [focado, setFocado] = useState(false);
  const [revelado, setRevelado] = useState(false);

  const corDaLinha = erro ? Cores.error : focado ? Cores.primary : Cores.outlineVariant;

  return (
    <View style={styles.container}>
      <Text style={[Tipografia.rotulo, styles.rotulo]}>{rotulo}</Text>

      <View style={[styles.linha, { borderBottomColor: corDaLinha }, focado && styles.linhaFocada]}>
        {icone ? (
          <MaterialIcons name={icone} size={20} color={Cores.onSurfaceVariant} />
        ) : null}

        <TextInput
          style={styles.input}
          placeholderTextColor={Cores.outline}
          secureTextEntry={segredo && !revelado}
          onFocus={(e) => {
            setFocado(true);
            resto.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            resto.onBlur?.(e);
          }}
          {...resto}
        />

        {segredo ? (
          <Pressable
            onPress={() => setRevelado((atual) => !atual)}
            hitSlop={Espaco.md}
            accessibilityRole="button"
            accessibilityLabel={revelado ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <MaterialIcons
              name={revelado ? 'visibility-off' : 'visibility'}
              size={20}
              color={revelado ? Cores.primary : Cores.onSurfaceVariant}
            />
          </Pressable>
        ) : null}
      </View>

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Espaco.xs },
  rotulo: { color: Cores.onSurfaceVariant, opacity: 0.7, marginLeft: Espaco.xs },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    minHeight: ALVO_TOQUE,
    paddingHorizontal: Espaco.lg,
    borderBottomWidth: 1,
    borderTopLeftRadius: Raio.md,
    borderTopRightRadius: Raio.md,
    backgroundColor: Overlay.borda,
  },
  linhaFocada: { backgroundColor: Cores.surfaceContainerLow },
  input: {
    flex: 1,
    color: Cores.onSurface,
    // 16px evita o zoom automático do iOS ao focar o campo.
    fontSize: TAMANHO_MINIMO_INPUT,
    paddingVertical: Espaco.md,
  },
  erro: { ...Tipografia.meta, color: Cores.error, marginLeft: Espaco.xs },
});
