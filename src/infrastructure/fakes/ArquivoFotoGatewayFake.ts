import { FotoPersistida, IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';

export class ArquivoFotoGatewayFake implements IArquivoFotoGateway {
  public salvos: Map<string, FotoPersistida> = new Map();
  public falharAoPersistir = false;

  async comprimirEPersistir(_uriTemporaria: string, nomeBase: string): Promise<FotoPersistida> {
    if (this.falharAoPersistir) {
      throw new Error('Não foi possível salvar a foto no aparelho');
    }

    const foto: FotoPersistida = {
      uri: `file:///documents/leituras/${nomeBase}.jpg`,
      bytes: 300_000,
      largura: 1080,
      altura: 1440,
    };
    this.salvos.set(foto.uri, foto);
    return foto;
  }

  async remover(uri: string): Promise<void> {
    this.salvos.delete(uri);
  }

  async existe(uri: string): Promise<boolean> {
    return this.salvos.has(uri);
  }
}
