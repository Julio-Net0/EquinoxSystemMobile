import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ALVO_TOQUE,
  Cores,
  Espaco,
  Overlay,
  Raio,
  TAMANHO_MINIMO_INPUT,
  Tipografia,
} from '@/constants/theme';

export interface ItemSelecionavel {
  id: string;
  rotulo: string;
  sublinha?: string;
}

export interface SeletorBuscaProps {
  rotulo: string;
  itens: ItemSelecionavel[];
  valorId: string | null;
  onSelecionar(id: string): void;
  placeholder?: string;
  textoVazio?: string;
  desabilitado?: boolean;
}

/**
 * Seleção única com busca, portada do `searchSelect` do app antigo.
 *
 * Duas decisões vêm de lá e importam em campo:
 * - a escolha é **só por toque**; digitar o nome exato não seleciona. Evita que
 *   o técnico ache que escolheu um endereço quando apenas digitou.
 * - nunca usa o seletor nativo da plataforma, que no Android vira uma lista
 *   minúscula e sem busca.
 *
 * Com um único item, mostra um chip fixo já selecionado em vez de obrigar a
 * abrir uma lista de um elemento.
 */
export function SeletorBusca({
  rotulo,
  itens,
  valorId,
  onSelecionar,
  placeholder = 'Toque para escolher',
  textoVazio = 'Nenhum resultado encontrado.',
  desabilitado = false,
}: SeletorBuscaProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const { bottom } = useSafeAreaInsets();

  const selecionado = itens.find((i) => i.id === valorId) ?? null;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;

    return itens.filter((i) =>
      `${i.rotulo} ${i.sublinha ?? ''}`.toLowerCase().includes(termo),
    );
  }, [itens, busca]);

  const abrir = () => {
    setBusca('');
    setAberto(true);
  };

  if (itens.length === 1) {
    const unico = itens[0];
    return (
      <View style={styles.container}>
        <Text style={[Tipografia.rotulo, styles.rotulo]}>{rotulo}</Text>
        <View style={styles.chipUnico}>
          <Text style={[Tipografia.corpoSm, styles.chipTexto]} numberOfLines={1}>
            {unico.sublinha ? `${unico.rotulo} · ${unico.sublinha}` : unico.rotulo}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[Tipografia.rotulo, styles.rotulo]}>{rotulo}</Text>

      <Pressable
        onPress={abrir}
        disabled={desabilitado || itens.length === 0}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        style={({ pressed }) => [
          styles.gatilho,
          selecionado && styles.gatilhoSelecionado,
          pressed && styles.pressionado,
          (desabilitado || itens.length === 0) && styles.inativo,
        ]}
      >
        <MaterialIcons
          name={selecionado ? 'check-circle' : 'search'}
          size={20}
          color={selecionado ? Cores.primary : Cores.onSurfaceVariant}
        />

        <Text
          style={[Tipografia.corpoSm, selecionado ? styles.chipTexto : styles.placeholder]}
          numberOfLines={1}
        >
          {selecionado
            ? selecionado.sublinha
              ? `${selecionado.rotulo} · ${selecionado.sublinha}`
              : selecionado.rotulo
            : placeholder}
        </Text>

        <MaterialIcons name="expand-more" size={20} color={Cores.onSurfaceVariant} />
      </Pressable>

      <Modal
        visible={aberto}
        transparent
        animationType="slide"
        onRequestClose={() => setAberto(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.fundo} onPress={() => setAberto(false)} />

        <View style={[styles.folha, { paddingBottom: bottom + Espaco.lg }]}>
          <Text style={[Tipografia.titulo, styles.folhaTitulo]}>{rotulo}</Text>

          <View style={styles.buscaLinha}>
            <MaterialIcons name="search" size={20} color={Cores.onSurfaceVariant} />
            <TextInput
              style={styles.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar…"
              placeholderTextColor={Cores.outline}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtrados}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.vazio}>{textoVazio}</Text>}
            renderItem={({ item }) => {
              const ehSelecionado = item.id === valorId;

              return (
                <Pressable
                  onPress={() => {
                    onSelecionar(item.id);
                    setAberto(false);
                  }}
                  android_ripple={{ color: Overlay.bordaForte }}
                  style={({ pressed }) => [styles.opcao, pressed && styles.opcaoPressionada]}
                >
                  <View style={styles.opcaoTextos}>
                    <Text style={[Tipografia.corpo, styles.opcaoRotulo]} numberOfLines={1}>
                      {item.rotulo}
                    </Text>
                    {item.sublinha ? (
                      <Text style={[Tipografia.meta, styles.opcaoSublinha]} numberOfLines={1}>
                        {item.sublinha}
                      </Text>
                    ) : null}
                  </View>

                  {ehSelecionado ? (
                    <MaterialIcons name="check" size={20} color={Cores.primary} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Espaco.xs },
  rotulo: { color: Cores.onSurfaceVariant, opacity: 0.7, marginLeft: Espaco.xs },
  gatilho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    minHeight: ALVO_TOQUE + 6,
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.outlineVariant,
    backgroundColor: Cores.surfaceContainerHigh,
  },
  gatilhoSelecionado: {
    borderColor: Overlay.primaryBorda,
    backgroundColor: Overlay.primaryFraco,
  },
  pressionado: { transform: [{ scale: 0.99 }] },
  inativo: { opacity: 0.5 },
  chipUnico: {
    minHeight: ALVO_TOQUE,
    justifyContent: 'center',
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Overlay.borda,
    backgroundColor: Cores.surfaceContainer,
  },
  chipTexto: { flex: 1, color: Cores.onSurface, fontWeight: '600' },
  placeholder: { flex: 1, color: Cores.onSurfaceVariant },

  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Overlay.modal,
  },
  folha: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: Cores.surfaceContainerHigh,
    borderTopLeftRadius: Raio.xl,
    borderTopRightRadius: Raio.xl,
    paddingTop: Espaco.xl,
    paddingHorizontal: Espaco.xl,
    gap: Espaco.lg,
  },
  folhaTitulo: { color: Cores.onSurface },
  buscaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.outlineVariant,
    backgroundColor: Cores.surfaceContainer,
  },
  buscaInput: {
    flex: 1,
    color: Cores.onSurface,
    fontSize: TAMANHO_MINIMO_INPUT,
    paddingVertical: Espaco.md,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    // Alvo generoso: a lista é usada em campo, com uma mão.
    minHeight: 56,
    paddingHorizontal: Espaco.sm,
    borderBottomWidth: 1,
    borderBottomColor: Overlay.borda,
  },
  opcaoPressionada: { backgroundColor: Overlay.borda },
  opcaoTextos: { flex: 1, gap: 2 },
  opcaoRotulo: { color: Cores.onSurface, fontWeight: '600' },
  opcaoSublinha: { color: Cores.onSurfaceVariant },
  vazio: {
    ...Tipografia.corpoSm,
    color: Cores.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: Espaco.xxl,
  },
});
