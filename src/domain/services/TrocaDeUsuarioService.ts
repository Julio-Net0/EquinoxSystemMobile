import { IActionQueueRepository } from '../repositories/IActionQueueRepository';
import { IDadosLocaisRepository } from '../repositories/IDadosLocaisRepository';
import {
  CHAVE_CURSORES,
  CHAVE_USUARIO_DO_CURSOR,
  ISyncMetaRepository,
} from '../repositories/ISyncMetaRepository';
import { IArquivoFotoGateway } from '../gateways/IArquivoFotoGateway';

/**
 * Prepara o aparelho para quem acabou de entrar (ADR 10.19).
 *
 * Quando é outra pessoa, o banco local ainda tem o que a anterior baixou — às
 * vezes de outra empresa. As telas filtram pelo escopo, mas o dado continuaria
 * no aparelho. Por isso, num login **com rede** de outro usuário, os dados
 * locais (e as fotos) são apagados e o pull seguinte baixa tudo de novo, só no
 * escopo de quem entrou.
 *
 * Duas exceções, pelas quais nada é apagado:
 * - há itens na fila de envio: são de alguém e ainda não subiram;
 * - o login foi sem rede: não daria para baixar os dados de volta.
 *
 * Em qualquer troca, os cursores do pull são zerados: eles valem para o que
 * UM usuário pode ver.
 */
export class TrocaDeUsuarioService {
  constructor(
    private readonly syncMeta: ISyncMetaRepository,
    private readonly fila: IActionQueueRepository,
    private readonly dadosLocais: IDadosLocaisRepository,
    private readonly arquivoFoto: IArquivoFotoGateway,
  ) {}

  public async prepararPara(usuarioId: string, opcoes: { comRede: boolean }): Promise<void> {
    if ((await this.syncMeta.obter(CHAVE_USUARIO_DO_CURSOR)) === usuarioId) return;

    if (opcoes.comRede && (await this.fila.contar()) === 0) {
      const fotos = await this.dadosLocais.limparTudo();
      for (const foto of fotos) {
        try {
          await this.arquivoFoto.remover(foto);
        } catch {
          // Arquivo que já não existe não impede a troca.
        }
      }
    }

    await this.syncMeta.definir(CHAVE_CURSORES, null);
    await this.syncMeta.definir(CHAVE_USUARIO_DO_CURSOR, usuarioId);
  }
}
