import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';

export interface OpcaoFiltro<T extends string> {
  valor: T;
  rotulo: string;
  contagem?: number;
}

export interface FiltroChipsProps<T extends string> {
  opcoes: OpcaoFiltro<T>[];
  selecionado: T;
  onSelecionar(valor: T): void;
}

/**
 * Trilha de chips de filtro, como a da tela de usuários do app antigo
 * (todos / pendentes / aprovados / reprovados).
 *
 * Rola na horizontal porque numa tela estreita quatro chips com contagem não
 * caberiam sem quebrar linha.
 */
export function FiltroChips<T extends string>({
  opcoes,
  selecionado,
  onSelecionar,
}: FiltroChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.trilha}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === selecionado;

        return (
          <Pressable
            key={opcao.valor}
            onPress={() => onSelecionar(opcao.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            style={({ pressed }) => [
              styles.chip,
              ativo && styles.chipAtivo,
              pressed && styles.pressionado,
            ]}
          >
            <Text style={[Tipografia.botaoSm, ativo ? styles.textoAtivo : styles.texto]}>
              {opcao.rotulo}
            </Text>

            {opcao.contagem !== undefined ? (
              <View style={[styles.contagem, ativo && styles.contagemAtiva]}>
                <Text style={[Tipografia.meta, ativo ? styles.textoAtivo : styles.texto]}>
                  {opcao.contagem}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  trilha: { gap: Espaco.sm, paddingHorizontal: Espaco.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    minHeight: 36,
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.pilula,
    borderWidth: 1,
    borderColor: Overlay.bordaForte,
    backgroundColor: Cores.surfaceContainerHigh,
  },
  chipAtivo: { backgroundColor: Cores.primary, borderColor: Cores.primary },
  pressionado: { opacity: 0.7 },
  texto: { color: Cores.onSurfaceVariant },
  textoAtivo: { color: '#000000' },
  contagem: {
    minWidth: 20,
    alignItems: 'center',
    paddingHorizontal: Espaco.xs,
    borderRadius: Raio.pilula,
    backgroundColor: Overlay.borda,
  },
  contagemAtiva: { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
});
