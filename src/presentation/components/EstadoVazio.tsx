import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Cores, Espaco, Tipografia } from '@/constants/theme';
import { SolarButton } from './SolarButton';

export interface EstadoVazioProps {
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
  descricao?: string;
  acao?: { titulo: string; onPress: () => void };
}

/**
 * Estado vazio das listas. Existe para a tela nunca mostrar uma área em branco
 * sem explicação — o app antigo sempre dizia o que fazer em seguida.
 */
export function EstadoVazio({ icone, titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <View style={styles.base}>
      <MaterialIcons name={icone} size={44} color={Cores.onSurfaceVariant} style={styles.icone} />

      <Text style={[Tipografia.tituloCard, styles.titulo]}>{titulo}</Text>

      {descricao ? <Text style={[Tipografia.corpoSm, styles.descricao]}>{descricao}</Text> : null}

      {acao ? (
        <View style={styles.acao}>
          <SolarButton titulo={acao.titulo} variante="secundario" onPress={acao.onPress} largo={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Espaco.xxxl,
    paddingHorizontal: Espaco.xl,
    gap: Espaco.sm,
  },
  icone: { opacity: 0.4 },
  titulo: { color: Cores.onSurface, textAlign: 'center' },
  descricao: { color: Cores.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },
  acao: { marginTop: Espaco.lg },
});
