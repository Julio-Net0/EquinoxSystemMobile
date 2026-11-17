import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Cores, Espaco, Raio, Tipografia } from '@/constants/theme';
import { ObterFotoDaLeituraOutput } from '@/application/use-cases/ObterFotoDaLeituraUseCase';
import { ModalShell } from './ModalShell';

export interface VisualizadorComprovanteProps {
  visivel: boolean;
  carregando: boolean;
  foto: ObterFotoDaLeituraOutput | null;
  onFechar(): void;
}

const ORIGEM: Record<'aparelho' | 'nuvem', string> = {
  aparelho: 'Arquivo guardado neste aparelho',
  nuvem: 'Baixada da nuvem por um endereço assinado que expira em instantes',
};

/**
 * Mostra o comprovante de uma leitura. A origem aparece na tela de propósito:
 * na demonstração ela mostra que a foto de outro aparelho só chega por URL
 * assinada, porque o bucket é privado.
 */
export function VisualizadorComprovante({
  visivel,
  carregando,
  foto,
  onFechar,
}: VisualizadorComprovanteProps) {
  return (
    <ModalShell
      visivel={visivel}
      titulo="Comprovante da leitura"
      subtitulo={foto?.origem ? ORIGEM[foto.origem] : undefined}
      icone="photo-camera"
      confirmarLabel="Fechar"
      onConfirmar={onFechar}
      onFechar={onFechar}
    >
      <View style={styles.area} testID="visualizador-comprovante">
        {carregando ? (
          <ActivityIndicator color={Cores.primary} />
        ) : foto?.uri ? (
          <Image source={{ uri: foto.uri }} style={styles.foto} resizeMode="contain" testID="foto-comprovante" />
        ) : (
          <Text style={[Tipografia.corpoSm, styles.aviso]} testID="aviso-comprovante">
            {foto?.aviso ?? 'Comprovante indisponível'}
          </Text>
        )}
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  area: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Raio.md,
    backgroundColor: Cores.surfaceContainerLow,
    padding: Espaco.sm,
  },
  foto: { width: '100%', height: 320, borderRadius: Raio.md },
  aviso: { color: Cores.onSurfaceVariant, textAlign: 'center' },
});
