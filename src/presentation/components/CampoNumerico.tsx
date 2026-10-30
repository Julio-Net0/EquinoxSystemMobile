import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Cores, Espaco, Tipografia } from '@/constants/theme';
import { CampoTexto, CampoTextoProps } from './CampoTexto';

export interface CampoNumericoProps
  extends Omit<CampoTextoProps, 'keyboardType' | 'segredo' | 'value' | 'onChangeText'> {
  valor: string;
  onChangeValor(texto: string): void;
  unidade?: string;
  /** Mostrado abaixo do campo, ex.: "Última: 11.150 kWh em 09/03/2026". */
  ajuda?: string;
}

/**
 * Campo de leitura em kWh.
 *
 * Aceita vírgula e ponto como separador decimal — o teclado numérico do Android
 * mostra um e o do iOS o outro, e o técnico digita o que vê. A conversão para
 * número é feita por quem consome o valor.
 */
export function CampoNumerico({
  valor,
  onChangeValor,
  unidade = 'kWh',
  ajuda,
  rotulo,
  ...resto
}: CampoNumericoProps) {
  const higienizar = (texto: string) => {
    // Só dígitos e um separador decimal; nada de sinal ou letra.
    const limpo = texto.replace(/[^\d.,]/g, '');
    const partes = limpo.split(/[.,]/);

    if (partes.length <= 1) return limpo;
    return `${partes[0]},${partes.slice(1).join('')}`;
  };

  return (
    <View style={styles.container}>
      <CampoTexto
        rotulo={`${rotulo} · ${unidade}`}
        value={valor}
        onChangeText={(texto) => onChangeValor(higienizar(texto))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        {...resto}
      />

      {ajuda ? <Text style={styles.ajuda}>{ajuda}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Espaco.xs },
  ajuda: {
    ...Tipografia.meta,
    color: Cores.onSurfaceVariant,
    marginLeft: Espaco.xs,
  },
});
