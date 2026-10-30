import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALVO_TOQUE, Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { IconeTile } from './IconeTile';
import { SolarButton } from './SolarButton';

export interface ModalShellProps {
  visivel: boolean;
  titulo: string;
  subtitulo?: string;
  icone?: keyof typeof MaterialIcons.glyphMap;
  tema?: 'padrao' | 'erro';
  children?: ReactNode;
  erro?: string;
  confirmarLabel: string;
  cancelarLabel?: string;
  confirmando?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}

/**
 * Folha inferior de confirmação, portada do modal do app antigo: faixa de
 * acento no topo, tile de ícone, título, corpo e o par confirmar/cancelar.
 *
 * Os seis modais da tela de estrutura, o de exclusão de usuário e a
 * confirmação de valor menor todos saem daqui, em vez de cada tela
 * reimplementar o seu.
 */
export function ModalShell({
  visivel,
  titulo,
  subtitulo,
  icone,
  tema = 'padrao',
  children,
  erro,
  confirmarLabel,
  cancelarLabel = 'Cancelar',
  confirmando = false,
  onConfirmar,
  onFechar,
}: ModalShellProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      {/* Toque no fundo escuro fecha, como no app antigo. */}
      <Pressable style={styles.fundo} onPress={onFechar} accessibilityLabel="Fechar" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.ancora}
        pointerEvents="box-none"
      >
        <View style={[styles.painel, { paddingBottom: bottom + Espaco.xl }]}>
          <View
            style={[
              styles.acento,
              { backgroundColor: tema === 'erro' ? Cores.error : Cores.primary },
            ]}
          />

          <View style={styles.cabecalho}>
            {icone ? <IconeTile icone={icone} tamanho={44} tom={tema === 'erro' ? 'erro' : 'primary'} /> : null}

            <View style={styles.textos}>
              <Text style={[Tipografia.titulo, styles.titulo]}>{titulo}</Text>
              {subtitulo ? (
                <Text style={[Tipografia.corpoSm, styles.subtitulo]}>{subtitulo}</Text>
              ) : null}
            </View>

            <Pressable
              onPress={onFechar}
              hitSlop={Espaco.sm}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={styles.fechar}
            >
              <MaterialIcons name="close" size={22} color={Cores.onSurfaceVariant} />
            </Pressable>
          </View>

          {children ? (
            <ScrollView
              style={styles.corpo}
              contentContainerStyle={styles.corpoConteudo}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : null}

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <View style={styles.acoes}>
            <SolarButton
              titulo={confirmarLabel}
              variante={tema === 'erro' ? 'perigo' : 'primario'}
              carregando={confirmando}
              onPress={onConfirmar}
            />
            <SolarButton titulo={cancelarLabel} variante="fantasma" onPress={onFechar} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Overlay.modal,
  },
  ancora: { flex: 1, justifyContent: 'flex-end' },
  painel: {
    backgroundColor: Cores.surfaceContainerHigh,
    borderTopLeftRadius: Raio.xl,
    borderTopRightRadius: Raio.xl,
    paddingHorizontal: Espaco.xl,
    paddingTop: Espaco.xl,
    gap: Espaco.lg,
    maxHeight: '88%',
  },
  acento: {
    position: 'absolute',
    top: 0,
    left: Espaco.xxxl,
    right: Espaco.xxxl,
    height: 2,
    opacity: 0.5,
    borderRadius: Raio.pilula,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  textos: { flex: 1, gap: 2 },
  titulo: { color: Cores.onSurface },
  subtitulo: { color: Cores.onSurfaceVariant, lineHeight: 19 },
  fechar: {
    width: ALVO_TOQUE,
    height: ALVO_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Espaco.md,
  },
  corpo: { flexGrow: 0 },
  corpoConteudo: { gap: Espaco.lg, paddingBottom: Espaco.xs },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  acoes: { gap: Espaco.sm },
});
