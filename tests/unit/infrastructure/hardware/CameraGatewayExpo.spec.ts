import { Camera } from 'expo-camera';
import {
  CameraGatewayExpo,
  PreviewNaoMontadoError,
} from '@/infrastructure/hardware/camera/CameraGatewayExpo';
import { FotoCapturada } from '@/domain/gateways/ICameraGateway';

const FOTO: FotoCapturada = { uri: 'file:///cache/medidor.jpg', largura: 3024, altura: 4032 };

describe('CameraGatewayExpo', () => {
  let gateway: CameraGatewayExpo;

  beforeEach(() => {
    gateway = new CameraGatewayExpo();
    jest.clearAllMocks();
  });

  describe('permissões', () => {
    it('consulta a permissão já concedida', async () => {
      (Camera.getCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
      expect(await gateway.temPermissao()).toBe(true);
    });

    it('devolve falso quando a permissão não foi concedida', async () => {
      (Camera.getCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
      expect(await gateway.temPermissao()).toBe(false);
    });

    it('pede a permissão ao usuário', async () => {
      (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });

      expect(await gateway.solicitarPermissao()).toBe(true);
      expect(Camera.requestCameraPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('captura pelo capturador registrado', () => {
    it('recusa capturar quando a câmera não está aberta', async () => {
      // É o caso de chamar capturar() sem a tela da câmera montada: sem ela não
      // existe ref da CameraView, e falhar claro é melhor que devolver null.
      await expect(gateway.capturar()).rejects.toThrow(PreviewNaoMontadoError);
      expect(gateway.temCapturador()).toBe(false);
    });

    it('usa o capturador registrado pela tela', async () => {
      gateway.registrarCapturador(async () => FOTO);

      expect(gateway.temCapturador()).toBe(true);
      expect(await gateway.capturar()).toEqual(FOTO);
    });

    it('devolve null quando o usuário fecha sem bater a foto', async () => {
      gateway.registrarCapturador(async () => null);
      expect(await gateway.capturar()).toBeNull();
    });

    it('propaga a falha do hardware em vez de engolir', async () => {
      gateway.registrarCapturador(async () => {
        throw new Error('câmera ocupada por outro app');
      });

      await expect(gateway.capturar()).rejects.toThrow('câmera ocupada por outro app');
    });
  });

  describe('ciclo de vida do preview', () => {
    it('o cancelamento devolvido limpa o capturador', async () => {
      const cancelar = gateway.registrarCapturador(async () => FOTO);

      cancelar();

      expect(gateway.temCapturador()).toBe(false);
      await expect(gateway.capturar()).rejects.toThrow(PreviewNaoMontadoError);
    });

    it('um registro novo substitui o anterior', async () => {
      gateway.registrarCapturador(async () => FOTO);
      gateway.registrarCapturador(async () => ({ ...FOTO, uri: 'file:///cache/nova.jpg' }));

      expect((await gateway.capturar())?.uri).toBe('file:///cache/nova.jpg');
    });

    it('o cancelamento de um capturador antigo não derruba o atual', async () => {
      // Acontece quando uma tela monta antes de a anterior desmontar: o cleanup
      // da antiga chega depois do registro da nova e não pode levá-la junto.
      const cancelarAntigo = gateway.registrarCapturador(async () => FOTO);
      gateway.registrarCapturador(async () => ({ ...FOTO, uri: 'file:///cache/nova.jpg' }));

      cancelarAntigo();

      expect(gateway.temCapturador()).toBe(true);
      expect((await gateway.capturar())?.uri).toBe('file:///cache/nova.jpg');
    });

    it('cancelar duas vezes não quebra', () => {
      const cancelar = gateway.registrarCapturador(async () => FOTO);

      cancelar();
      expect(() => cancelar()).not.toThrow();
    });
  });
});
