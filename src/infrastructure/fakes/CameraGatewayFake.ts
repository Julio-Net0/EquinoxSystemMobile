import { ICameraGateway, CapturarFotoResultado } from '@/domain/gateways/ICameraGateway';

export class CameraGatewayFake implements ICameraGateway {
  public permissaoConcedida: boolean = true;
  public fotoFakeUri: string = 'file:///cache/medidor_fake_1080p.jpg';
  public tamanhoFakeBytes: number = 307200; // ~300KB

  async solicitarPermissao(): Promise<boolean> {
    return this.permissaoConcedida;
  }

  async capturarEComprimirFoto(): Promise<CapturarFotoResultado | null> {
    if (!this.permissaoConcedida) {
      return null;
    }
    return {
      uri: this.fotoFakeUri,
      sizeBytes: this.tamanhoFakeBytes,
    };
  }
}
