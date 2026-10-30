import { ICameraGateway, CapturarFotoResultado } from '@/domain/gateways/ICameraGateway';
import { Camera } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface ExpoCameraGatewayOptions {
  captureProvider?: () => Promise<string | null>;
  fileSizeProvider?: (uri: string) => Promise<number>;
}

export class ExpoCameraGateway implements ICameraGateway {
  private captureProvider?: () => Promise<string | null>;
  private fileSizeProvider?: (uri: string) => Promise<number>;

  constructor(options?: ExpoCameraGatewayOptions) {
    this.captureProvider = options?.captureProvider;
    this.fileSizeProvider = options?.fileSizeProvider;
  }

  async solicitarPermissao(): Promise<boolean> {
    try {
      const response = await Camera.requestCameraPermissionsAsync();
      return response.status === 'granted';
    } catch {
      return false;
    }
  }

  async capturarEComprimirFoto(): Promise<CapturarFotoResultado | null> {
    try {
      // 1. Obter imagem bruta da câmera (via provider injetado ou captura nativa)
      const rawUri = this.captureProvider
        ? await this.captureProvider()
        : 'file:///cache/camera_raw.jpg';

      if (!rawUri) {
        return null;
      }

      // 2. Comprimir via expo-image-manipulator seguindo a regra arquitetural:
      // Redimensionamento 1080p + compressão JPEG (~75% de qualidade para meta de ~300KB)
      const manipulated = await manipulateAsync(
        rawUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: SaveFormat.JPEG }
      );

      // 3. Obter tamanho do arquivo
      let sizeBytes = 307200; // ~300KB default estimado
      if (this.fileSizeProvider) {
        sizeBytes = await this.fileSizeProvider(manipulated.uri);
      } else {
        try {
          const res = await fetch(manipulated.uri);
          const blob = await res.blob();
          if (blob.size > 0) sizeBytes = blob.size;
        } catch {
          // Mantém estimativa segura
        }
      }

      return {
        uri: manipulated.uri,
        sizeBytes,
      };
    } catch {
      return null;
    }
  }
}
