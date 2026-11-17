import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { ISincronizacaoRemotaGateway } from '@/domain/gateways/ISincronizacaoRemotaGateway';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export interface ObterFotoDaLeituraOutput {
  /** Endereço pronto para um componente de imagem, ou nulo se não há foto. */
  uri: string | null;
  origem: 'aparelho' | 'nuvem' | null;
  /** Por que não há foto para mostrar, em linguagem de tela. */
  aviso?: string;
}

/**
 * Resolve de onde mostrar o comprovante de uma leitura.
 *
 * O arquivo local vem primeiro: funciona sem rede e não gasta dados. A nuvem
 * é o plano B — para a leitura feita em outro aparelho, ou quando o sistema
 * apagou o arquivo local. Como o bucket é privado, a foto remota só é
 * alcançável por um endereço assinado de vida curta, emitido pelo servidor
 * apenas para quem tem permissão de vê-la.
 */
export class ObterFotoDaLeituraUseCase {
  constructor(
    private readonly leituraRepo: ILeituraRepository,
    private readonly arquivoFoto: IArquivoFotoGateway,
    private readonly remoto: ISincronizacaoRemotaGateway,
  ) {}

  public async executar(entrada: { leituraId: string }): Promise<ObterFotoDaLeituraOutput> {
    const leitura = await this.leituraRepo.buscarPorId(new UUIDv4(entrada.leituraId));
    if (!leitura) return { uri: null, origem: null, aviso: 'Leitura não encontrada' };

    if (leitura.temFotoNoAparelho() && (await this.existeNoAparelho(leitura.fotoLocalUri))) {
      return { uri: leitura.fotoLocalUri, origem: 'aparelho' };
    }

    if (!leitura.fotoRemotaPath) {
      return { uri: null, origem: null, aviso: 'A foto desta leitura não está neste aparelho' };
    }

    const assinada = await this.remoto.urlAssinadaDaFoto(leitura.fotoRemotaPath);
    if (!assinada.ok) {
      return {
        uri: null,
        origem: null,
        aviso:
          assinada.motivo === 'rede'
            ? 'A foto está na nuvem. Conecte-se para vê-la'
            : 'Não foi possível abrir a foto na nuvem',
      };
    }

    return { uri: assinada.valor, origem: 'nuvem' };
  }

  /** Na web a API de arquivos não responde; ali a foto local é tida como ausente. */
  private async existeNoAparelho(uri: string): Promise<boolean> {
    try {
      return await this.arquivoFoto.existe(uri);
    } catch {
      return false;
    }
  }
}
