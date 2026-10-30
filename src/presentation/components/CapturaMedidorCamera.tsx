import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { useCameraExpo } from '@/presentation/context/ContainerProviderSQLite';
import { SolarButton } from './SolarButton';

export interface CapturaMedidorCameraProps {
  visivel: boolean;
  onFechar(): void;
  /** Chamado após a captura; a compressão e a persistência vêm depois. */
  onCapturada(): void;
}

/**
 * Preview da câmera para fotografar o visor do medidor.
 *
 * É o único lugar do app que conhece a `CameraView`. O gateway da câmera não
 * pode guardar a ref — ela só existe enquanto este componente está montado —
 * então aqui registramos um capturador nele e devolvemos a função de
 * cancelamento no cleanup. É isso que respeita o limite de um preview ativo por
 * vez do SDK 57.
 */
export function CapturaMedidorCamera({
  visivel,
  onFechar,
  onCapturada,
}: CapturaMedidorCameraProps) {
  const camera = useCameraExpo();
  const refCamera = useRef<CameraView>(null);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [pronta, setPronta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const { top, bottom } = useSafeAreaInsets();

  useEffect(() => {
    if (!visivel) return undefined;

    const cancelar = camera.registrarCapturador(async () => {
      const foto = await refCamera.current?.takePictureAsync({
        quality: 1,
        // A compressão é feita depois, pelo IArquivoFotoGateway.
        skipProcessing: true,
      });
      if (!foto) return null;

      return { uri: foto.uri, largura: foto.width, altura: foto.height };
    });

    return cancelar;
  }, [visivel, camera]);

  const disparar = async () => {
    setCapturando(true);
    try {
      onCapturada();
    } finally {
      setCapturando(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      <View style={styles.raiz}>
        {permissao?.granted ? (
          <>
            {/* A CameraView é desmontada junto com o modal: sem isso o preview
                seguiria ativo e bloquearia a próxima abertura. */}
            <CameraView
              ref={refCamera}
              style={styles.preview}
              facing="back"
              mode="picture"
              onCameraReady={() => setPronta(true)}
            />

            <View style={[styles.sobreposicao, { paddingTop: top + Espaco.lg }]} pointerEvents="box-none">
              <View style={styles.instrucaoCaixa}>
                <Text style={styles.instrucao}>
                  Centralize o visor do medidor na moldura
                </Text>
              </View>

              <View style={styles.moldura} />

              <View style={[styles.controles, { paddingBottom: bottom + Espaco.xl }]}>
                <Pressable
                  onPress={onFechar}
                  hitSlop={Espaco.md}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar câmera"
                  style={styles.botaoSecundario}
                >
                  <MaterialIcons name="close" size={26} color={Cores.onSurface} />
                </Pressable>

                <Pressable
                  onPress={disparar}
                  disabled={!pronta || capturando}
                  accessibilityRole="button"
                  accessibilityLabel="Tirar foto do medidor"
                  style={({ pressed }) => [
                    styles.disparador,
                    pressed && styles.disparadorPressionado,
                    (!pronta || capturando) && styles.inativo,
                  ]}
                >
                  <View style={styles.disparadorInterno} />
                </Pressable>

                {/* Espaço reservado para o disparador ficar centralizado. */}
                <View style={styles.botaoSecundario} />
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.semPermissao, { paddingTop: top + Espaco.xxxl }]}>
            <MaterialIcons name="no-photography" size={48} color={Cores.onSurfaceVariant} />

            <Text style={[Tipografia.titulo, styles.semPermissaoTitulo]}>
              Câmera sem permissão
            </Text>
            <Text style={[Tipografia.corpoSm, styles.semPermissaoTexto]}>
              A foto do medidor é o comprovante da leitura, então a câmera é
              obrigatória para registrar.
            </Text>

            <View style={styles.semPermissaoAcoes}>
              <SolarButton titulo="Permitir câmera" onPress={() => void pedirPermissao()} />
              <SolarButton titulo="Voltar" variante="fantasma" onPress={onFechar} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#000000' },
  preview: { flex: 1 },
  sobreposicao: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  instrucaoCaixa: {
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.sm,
    borderRadius: Raio.pilula,
    backgroundColor: Overlay.modal,
  },
  instrucao: { ...Tipografia.corpoSm, color: Cores.onSurface },
  moldura: {
    width: '80%',
    aspectRatio: 16 / 9,
    borderWidth: 2,
    borderColor: Cores.primary,
    borderRadius: Raio.lg,
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Espaco.xxl,
  },
  botaoSecundario: {
    width: 52,
    height: 52,
    borderRadius: Raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Overlay.modal,
  },
  disparador: {
    width: 76,
    height: 76,
    borderRadius: Raio.pilula,
    borderWidth: 4,
    borderColor: Cores.onSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparadorPressionado: { transform: [{ scale: 0.94 }] },
  disparadorInterno: {
    width: 58,
    height: 58,
    borderRadius: Raio.pilula,
    backgroundColor: Cores.primary,
  },
  inativo: { opacity: 0.4 },
  semPermissao: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Espaco.xxl,
    gap: Espaco.md,
    backgroundColor: Cores.surface,
  },
  semPermissaoTitulo: { color: Cores.onSurface, textAlign: 'center' },
  semPermissaoTexto: {
    color: Cores.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  semPermissaoAcoes: { alignSelf: 'stretch', gap: Espaco.sm, marginTop: Espaco.xl },
});
