import { ExpoCameraGateway } from '@/infrastructure/hardware/ExpoCameraGateway';
import { Camera } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
    getCameraPermissionsAsync: jest.fn(),
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

describe('ExpoCameraGateway (Infraestrutura Concreta)', () => {
  let gateway: ExpoCameraGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ExpoCameraGateway();
  });

  it('deve solicitar permissao de camera e retornar true quando concedida', async () => {
    (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });

    const concedida = await gateway.solicitarPermissao();
    expect(concedida).toBe(true);
    expect(Camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('deve retornar false quando a permissao de camera for negada', async () => {
    (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
    });

    const concedida = await gateway.solicitarPermissao();
    expect(concedida).toBe(false);
  });

  it('deve comprimir a foto capturada em JPEG 1080p com qualidade otimizada (~300KB)', async () => {
    // Configura provider de captura com URI bruto da foto
    const rawPhotoUri = 'file:///data/camera/raw_photo_4k.jpg';
    gateway = new ExpoCameraGateway({
      captureProvider: async () => rawPhotoUri,
      fileSizeProvider: async () => 285400, // ~280KB
    });

    (manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///cache/ImageManipulator/compressed_1080p.jpg',
      width: 1080,
      height: 1920,
    });

    const resultado = await gateway.capturarEComprimirFoto();

    expect(resultado).not.toBeNull();
    expect(resultado?.uri).toBe('file:///cache/ImageManipulator/compressed_1080p.jpg');
    expect(resultado?.sizeBytes).toBe(285400);

    // Verifica que a compressao obedeceu as regras do ADR / Requisitos:
    // 1. Redimensionamento com largura maxima de 1080px
    // 2. Compressao JPEG (0.75)
    expect(manipulateAsync).toHaveBeenCalledWith(
      rawPhotoUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.75, format: SaveFormat.JPEG }
    );
  });

  it('deve retornar null se a captura falhar ou for cancelada', async () => {
    gateway = new ExpoCameraGateway({
      captureProvider: async () => null,
    });

    const resultado = await gateway.capturarEComprimirFoto();
    expect(resultado).toBeNull();
    expect(manipulateAsync).not.toHaveBeenCalled();
  });
});
