import {
  EstadoDoBanco,
  IDiagnosticoLocalGateway,
} from '@/domain/gateways/IDiagnosticoLocalGateway';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';

export interface LeituraDiagnosticoDTO {
  leituraId: string;
  valorConsumo: number;
  valorInjecao: number | null;
  dataLocal: string;
  medidoEm: string;
  status: StatusLeituraEnum;
  temLocalizacao: boolean;
  fotoLocalUri: string;
  /**
   * Verdadeiro quando o arquivo está no disco, falso quando a linha existe mas
   * o arquivo não, e **nulo quando não foi possível verificar** — a API de
   * arquivos do Expo não responde na web, e dizer "não existe" ali seria
   * afirmar algo que não se sabe.
   */
  fotoExiste: boolean | null;
}

export interface ConsultarDiagnosticoInput {
  usuarioId: string;
  limite?: number;
}

export interface ConsultarDiagnosticoOutput {
  banco: EstadoDoBanco;
  ultimasLeituras: LeituraDiagnosticoDTO[];
}

const LIMITE_PADRAO = 8;

/**
 * Junta o que é preciso para conferir que os dados estão mesmo no aparelho:
 * o estado do banco e as últimas leituras do usuário, com a checagem de que o
 * arquivo de cada foto existe de verdade.
 *
 * A checagem da foto importa porque a linha no banco e o arquivo no disco são
 * duas coisas separadas — e as leituras do seed, por exemplo, têm linha mas
 * não têm arquivo.
 */
export class ConsultarDiagnosticoUseCase {
  constructor(
    private readonly diagnostico: IDiagnosticoLocalGateway,
    private readonly leituraRepo: ILeituraRepository,
    private readonly arquivoFoto: IArquivoFotoGateway,
  ) {}

  public async executar(
    entrada: ConsultarDiagnosticoInput,
  ): Promise<ConsultarDiagnosticoOutput> {
    const banco = await this.diagnostico.coletar();

    const leituras = await this.leituraRepo.listarPorUsuario(
      new UUIDv4(entrada.usuarioId),
      entrada.limite ?? LIMITE_PADRAO,
    );

    const ultimasLeituras: LeituraDiagnosticoDTO[] = [];
    for (const leitura of leituras) {
      ultimasLeituras.push({
        leituraId: leitura.id.value,
        valorConsumo: leitura.valorConsumo.valor,
        valorInjecao: leitura.valorInjecao?.valor ?? null,
        dataLocal: leitura.dataLocal.value,
        medidoEm: leitura.medidoEm.toISOString(),
        status: leitura.status,
        temLocalizacao: leitura.temLocalizacao(),
        fotoLocalUri: leitura.fotoLocalUri,
        fotoExiste: await this.verificarFoto(leitura.fotoLocalUri),
      });
    }

    return { banco, ultimasLeituras };
  }

  /** Uma falha ao consultar o disco não derruba o diagnóstico inteiro. */
  private async verificarFoto(uri: string): Promise<boolean | null> {
    try {
      return await this.arquivoFoto.existe(uri);
    } catch {
      return null;
    }
  }
}
