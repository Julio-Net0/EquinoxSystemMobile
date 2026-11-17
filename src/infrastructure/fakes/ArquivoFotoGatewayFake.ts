import { FotoPersistida, IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';

/** Pasta de documentos simulada, para montar a uri de exibição. */
const PASTA_DO_APP = 'file:///documents';

export class ArquivoFotoGatewayFake implements IArquivoFotoGateway {
  public salvos: Map<string, FotoPersistida> = new Map();
  public falharAoPersistir = false;

  async comprimirEPersistir(_uriTemporaria: string, nomeBase: string): Promise<FotoPersistida> {
    if (this.falharAoPersistir) {
      throw new Error('Não foi possível salvar a foto no aparelho');
    }

    const foto: FotoPersistida = {
      uri: `leituras/${nomeBase}.jpg`,
      bytes: 300_000,
      largura: 1080,
      altura: 1440,
    };
    this.salvos.set(foto.uri, foto);
    return foto;
  }

  async remover(referencia: string): Promise<void> {
    this.salvos.delete(referencia);
  }

  async existe(referencia: string): Promise<boolean> {
    return this.salvos.has(referencia);
  }

  uriParaExibir(referencia: string): string {
    return referencia.includes('://') ? referencia : `${PASTA_DO_APP}/${referencia}`;
  }
}
