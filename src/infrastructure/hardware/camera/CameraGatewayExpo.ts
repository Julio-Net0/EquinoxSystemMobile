import { Camera } from 'expo-camera';
import { FotoCapturada, ICameraGateway } from '@/domain/gateways/ICameraGateway';

export type Capturador = () => Promise<FotoCapturada | null>;

export class PreviewNaoMontadoError extends Error {
  constructor() {
    super('A câmera não está aberta');
    this.name = 'PreviewNaoMontadoError';
  }
}

/**
 * Captura pela câmera do aparelho.
 *
 * `CameraView` é um componente React e `takePictureAsync` vive numa ref que só
 * existe enquanto a tela está montada — uma classe não pode possuí-la. Em vez
 * de vazar o tipo do Expo para o domínio, o componente de captura registra aqui
 * uma função, e o gateway apenas a chama.
 *
 * O registro devolve a função de cancelamento, usada no cleanup do efeito: o
 * SDK 57 admite um preview ativo por vez, então a `CameraView` é desmontada
 * quando a tela perde o foco e o capturador sai junto.
 */
export class CameraGatewayExpo implements ICameraGateway {
  private capturador: Capturador | null = null;

  public registrarCapturador(capturador: Capturador): () => void {
    this.capturador = capturador;

    return () => {
      // Só limpa se ainda for o mesmo: uma tela que monta antes da anterior
      // desmontar não deve perder o capturador novo.
      if (this.capturador === capturador) this.capturador = null;
    };
  }

  public temCapturador(): boolean {
    return this.capturador !== null;
  }

  async temPermissao(): Promise<boolean> {
    const { granted } = await Camera.getCameraPermissionsAsync();
    return granted;
  }

  async solicitarPermissao(): Promise<boolean> {
    const { granted } = await Camera.requestCameraPermissionsAsync();
    return granted;
  }

  async capturar(): Promise<FotoCapturada | null> {
    if (!this.capturador) throw new PreviewNaoMontadoError();
    return this.capturador();
  }
}
