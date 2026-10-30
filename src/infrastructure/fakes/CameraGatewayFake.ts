import { FotoCapturada, ICameraGateway } from '@/domain/gateways/ICameraGateway';

export class CameraGatewayFake implements ICameraGateway {
  public permissaoConcedida = true;
  public fotoFake: FotoCapturada = {
    uri: 'file:///cache/medidor_fake.jpg',
    largura: 3024,
    altura: 4032,
  };
  /** Simula o usuário fechando a câmera sem bater a foto. */
  public cancelarCaptura = false;

  async temPermissao(): Promise<boolean> {
    return this.permissaoConcedida;
  }

  async solicitarPermissao(): Promise<boolean> {
    return this.permissaoConcedida;
  }

  async capturar(): Promise<FotoCapturada | null> {
    if (!this.permissaoConcedida || this.cancelarCaptura) return null;
    return this.fotoFake;
  }
}
