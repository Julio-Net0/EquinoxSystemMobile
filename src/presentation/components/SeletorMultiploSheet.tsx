import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { ItemSelecionavel } from './SeletorBusca';
import { SolarButton } from './SolarButton';

export interface SeletorMultiploSheetProps {
  rotulo: string;
  itens: ItemSelecionavel[];
  selecionados: string[];
  onChange(ids: string[]): void;
  textoVazio?: string;
  /** Rótulo singular/plural do contador, ex.: ['endereço', 'endereços']. */
  nomeDoItem?: [string, string];
}

/**
 * Multi-seleção em folha inferior, portada do `enderecoMultiSelect` do app
 * antigo: gatilho com contagem, busca, linhas de alvo grande e chips
 * removíveis abaixo.
 *
 * A seleção é aplicada só ao confirmar: marcar e desmarcar várias linhas sem
 * disparar efeito a cada toque evita recarregar lista a cada clique.
 */
export function SeletorMultiploSheet({
  rotulo,
  itens,
  selecionados,
  onChange,
  textoVazio = 'Nenhum item disponível.',
  nomeDoItem = ['endereço', 'endereços'],
}: SeletorMultiploSheetProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState<string[]>(selecionados);
  const { bottom } = useSafeAreaInsets();

  const escolhidos = useMemo(
    () => itens.filter((i) => selecionados.includes(i.id)),
    [itens, selecionados],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((i) => `${i.rotulo} ${i.sublinha ?? ''}`.toLowerCase().includes(termo));
  }, [itens, busca]);

  const abrir = () => {
    setRascunho(selecionados);
    setBusca('');
    setAberto(true);
  };

  const alternar = (id: string) =>
    setRascunho((atual) =>
      atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id],
    );

  const confirmar = () => {
    onChange(rascunho);
    setAberto(false);
  };

  const [singular, plural] = nomeDoItem;
  const resumo =
    selecionados.length === 0
      ? 'Toque para selecionar'
      : selecionados.length === 1
        ? `1 ${singular} selecionado`
        : `${selecionados.length} ${plural} selecionados`;

  return (
    <View style={styles.container}>
      <Text style={[Tipografia.rotulo, styles.rotulo]}>{rotulo}</Text>

      <Pressable
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        style={({ pressed }) => [styles.gatilho, pressed && styles.pressionado]}
      >
        <MaterialIcons name="location-on" size={20} color={Cores.primary} />
        <Text
          style={[
            Tipografia.corpoSm,
            selecionados.length > 0 ? styles.resumoAtivo : styles.resumoVazio,
          ]}
          numberOfLines={1}
        >
          {resumo}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={Cores.onSurfaceVariant} />
      </Pressable>

      {escolhidos.length > 0 ? (
        <View style={styles.chips}>
          {escolhidos.map((item) => (
            <View key={item.id} style={styles.chip}>
              <Text style={[Tipografia.meta, styles.chipTexto]} numberOfLines={1}>
                {item.sublinha ? `${item.rotulo} · ${item.sublinha}` : item.rotulo}
              </Text>
              <Pressable
                onPress={() => onChange(selecionados.filter((i) => i !== item.id))}
                hitSlop={Espaco.sm}
                accessibilityRole="button"
                accessibilityLabel={`Remover ${item.rotulo}`}
              >
                <MaterialIcons name="close" size={14} color={Cores.onSurfaceVariant} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

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
              const marcado = rascunho.includes(item.id);

              return (
                <Pressable
                  onPress={() => alternar(item.id)}
                  android_ripple={{ color: Overlay.bordaForte }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                  style={({ pressed }) => [styles.linha, pressed && styles.linhaPressionada]}
                >
                  <MaterialIcons
                    name={marcado ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={marcado ? Cores.primary : Cores.outlineVariant}
                  />

                  <View style={styles.linhaTextos}>
                    <Text style={[Tipografia.corpo, styles.linhaRotulo]} numberOfLines={1}>
                      {item.rotulo}
                    </Text>
                    {item.sublinha ? (
                      <Text style={[Tipografia.meta, styles.linhaSublinha]} numberOfLines={1}>
                        {item.sublinha}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />

          <SolarButton
            titulo={`Concluir (${rascunho.length})`}
            onPress={confirmar}
            icone="check"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Espaco.sm },
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
  pressionado: { transform: [{ scale: 0.99 }] },
  resumoAtivo: { flex: 1, color: Cores.onSurface, fontWeight: '600' },
  resumoVazio: { flex: 1, color: Cores.onSurfaceVariant },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    maxWidth: '100%',
    paddingVertical: Espaco.xs,
    paddingHorizontal: Espaco.md,
    borderRadius: Raio.pilula,
    borderWidth: 1,
    borderColor: Overlay.primaryBorda,
    backgroundColor: Overlay.primaryFraco,
  },
  chipTexto: { color: Cores.onSurface, fontWeight: '600', flexShrink: 1 },

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
    maxHeight: '85%',
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
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    // 56px: alvo de toque confortável para marcar vários itens em sequência.
    minHeight: 56,
    paddingHorizontal: Espaco.sm,
    borderBottomWidth: 1,
    borderBottomColor: Overlay.borda,
  },
  linhaPressionada: { backgroundColor: Overlay.borda },
  linhaTextos: { flex: 1, gap: 2 },
  linhaRotulo: { color: Cores.onSurface, fontWeight: '600' },
  linhaSublinha: { color: Cores.onSurfaceVariant },
  vazio: {
    ...Tipografia.corpoSm,
    color: Cores.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: Espaco.xxl,
  },
});
