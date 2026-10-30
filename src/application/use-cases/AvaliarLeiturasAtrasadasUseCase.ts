import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { Notificacao } from '@/domain/entities/Notificacao';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { RegraLeituraAtrasadaService } from '@/domain/services/RegraLeituraAtrasadaService';
import { RegraLocalizacaoLeituraService } from '@/domain/services/RegraLocalizacaoLeituraService';
import { GeradorNotificacoesService } from '@/domain/services/GeradorNotificacoesService';

export interface AvaliarLeiturasAtrasadasOutput {
  criadas: number;
}

/**
 * Varredor de boot: avisa das leituras que cruzaram o limite de 7 dias sem
 * ninguém mexer nelas.
 *
 * Existe porque offline o tempo passa sem nenhum evento: uma leitura registrada
 * ontem e esquecida vira atrasada por si só, e nada no fluxo de registro
 * voltaria a olhar para ela.
 */
export class AvaliarLeiturasAtrasadasUseCase {
  constructor(
    private readonly leituraRepo: ILeituraRepository,
    private readonly padraoRepo: IPadraoRepository,
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly notificacaoRepo: INotificacaoRepository,
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(): Promise<AvaliarLeiturasAtrasadasOutput> {
    const agora = this.relogio.agora();
    const hoje = DataLocal.de(agora);

    // dataLocal < (hoje - 7 dias) é exatamente "atraso maior que 7 dias".
    const corte = DataLocal.de(
      new Date(agora.getTime() - RegraLeituraAtrasadaService.DIAS_LIMITE * 86_400_000),
    );
    const candidatas = await this.leituraRepo.listarRegistradasAntesDe(corte);

    const novas: Notificacao[] = [];

    for (const leitura of candidatas) {
      const jaAvisada = (await this.notificacaoRepo.buscarPorLeitura(leitura.id)).some(
        (n) => n.tipo === TipoNotificacaoEnum.LEITURA_ATRASADA,
      );
      if (jaAvisada) continue;

      const padrao = await this.padraoRepo.buscarPorId(leitura.padraoId);
      if (!padrao) continue;

      const endereco = await this.enderecoRepo.buscarPorId(padrao.enderecoId);
      if (!endereco) continue;

      const autor = await this.usuarioRepo.buscarPorId(leitura.usuarioId);

      const notificacao = GeradorNotificacoesService.paraAtrasoDetectado({
        leitura,
        referencia: null,
        substituida: null,
        // O varredor não reavalia localização: a leitura já foi registrada e a
        // divergência de GPS, se houve, foi avisada na hora.
        localizacao: RegraLocalizacaoLeituraService.avaliar(null, null),
        empresaId: endereco.empresaId,
        padraoNumero: padrao.numero,
        enderecoApelido: endereco.apelido,
        autorNome: autor?.nome ?? 'Técnico',
        hoje,
        agora,
      });

      if (notificacao) novas.push(notificacao);
    }

    if (novas.length > 0) {
      await this.notificacaoRepo.salvarVarias(novas);
    }

    return { criadas: novas.length };
  }
}
