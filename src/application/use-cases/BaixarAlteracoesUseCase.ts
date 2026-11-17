import {
  CursoresDePull,
  ISincronizacaoRemotaGateway,
  PacoteDeAlteracoes,
} from '@/domain/gateways/ISincronizacaoRemotaGateway';
import { MotivoFalhaRemota } from '@/domain/gateways/ResultadoRemoto';
import {
  IUnidadeDeTrabalho,
  RepositoriosDaTransacao,
} from '@/domain/repositories/IUnidadeDeTrabalho';
import { CHAVE_CURSORES, ISyncMetaRepository } from '@/domain/repositories/ISyncMetaRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';

export interface BaixarAlteracoesInput {
  /** Usuário da sessão: é pela mudança de escopo dele que o pull recomeça. */
  usuarioId: string;
}

export interface BaixarAlteracoesOutput {
  sucesso: boolean;
  recebidos: number;
  /** Linhas que vieram e não puderam ser aplicadas, com o motivo. */
  ignorados: string[];
  motivo?: MotivoFalhaRemota;
  erro?: string;
}

/** Limite de rodadas quando o escopo do usuário muda no meio do pull. */
const MAXIMO_DE_RODADAS = 2;

/**
 * Pull: traz da nuvem o que mudou e aplica no SQLite.
 *
 * - **Incremental.** Para cada tabela o aparelho guarda um cursor — o maior
 *   carimbo de atualização do servidor que já recebeu — e pede só o que veio
 *   depois. O carimbo é sempre do relógio do servidor; relógio de aparelho não
 *   serve de cursor.
 * - **Restrito ao que o usuário pode ver.** Quem filtra é o servidor (RLS). O
 *   aparelho não pede "os dados da empresa X": pede "o que mudou", e recebe só
 *   o que as políticas deixam passar.
 * - **Tudo ou nada.** O pacote inteiro e os cursores novos são gravados numa
 *   única transação. Cursor adiantado sem os dados faria o aparelho pular
 *   alterações para sempre.
 * - **Conflito: última escrita vence, arbitrada pelo servidor.** O que chega
 *   sobrescreve o local — exceto a leitura que ainda tem alteração local não
 *   enviada, que espera o próprio envio.
 *
 * As telas nunca consultam a nuvem: leem o SQLite, que este caso de uso
 * alimenta.
 */
export class BaixarAlteracoesUseCase {
  constructor(
    private readonly remoto: ISincronizacaoRemotaGateway,
    private readonly unidadeDeTrabalho: IUnidadeDeTrabalho,
    private readonly syncMeta: ISyncMetaRepository,
  ) {}

  public async executar(entrada: BaixarAlteracoesInput): Promise<BaixarAlteracoesOutput> {
    const saida: BaixarAlteracoesOutput = { sucesso: true, recebidos: 0, ignorados: [] };
    const eu = new UUIDv4(entrada.usuarioId);

    for (let rodada = 0; rodada < MAXIMO_DE_RODADAS; rodada += 1) {
      const baixado = await this.remoto.baixarAlteracoes(await this.lerCursores());
      if (!baixado.ok) {
        return { ...saida, sucesso: false, motivo: baixado.motivo, erro: baixado.mensagem };
      }

      const pacote = baixado.valor;
      saida.recebidos += BaixarAlteracoesUseCase.tamanho(pacote);
      saida.ignorados.push(...pacote.ignorados);

      const escopoMudou = await this.unidadeDeTrabalho.executar(async (repos) => {
        const mudou = await this.aplicar(pacote, repos, eu, saida.ignorados);
        // Mudou o que o usuário pode ver (novo vínculo, outro nível): linhas
        // antigas que só agora ficaram visíveis não têm carimbo novo, então o
        // incremental nunca as traria. Zera os cursores e baixa tudo de novo.
        await repos.syncMeta.definir(
          CHAVE_CURSORES,
          mudou ? null : JSON.stringify(pacote.cursores),
        );
        return mudou;
      });

      if (!escopoMudou) break;
    }

    return saida;
  }

  private async lerCursores(): Promise<CursoresDePull> {
    const guardado = await this.syncMeta.obter(CHAVE_CURSORES);
    if (!guardado) return {};

    try {
      return JSON.parse(guardado) as CursoresDePull;
    } catch {
      // Cursor ilegível equivale a nunca ter sincronizado: baixa tudo.
      return {};
    }
  }

  private static tamanho(pacote: PacoteDeAlteracoes): number {
    return (
      pacote.empresas.length +
      pacote.enderecos.length +
      pacote.padroes.length +
      pacote.usuarios.length +
      pacote.leituras.length +
      pacote.notificacoes.length +
      pacote.exclusoes.length
    );
  }

  /**
   * Aplica o pacote na ordem das chaves estrangeiras do SQLite. Devolve true
   * quando o escopo do próprio usuário mudou.
   */
  private async aplicar(
    pacote: PacoteDeAlteracoes,
    repos: RepositoriosDaTransacao,
    eu: UUIDv4,
    ignorados: string[],
  ): Promise<boolean> {
    const escopoAntes = BaixarAlteracoesUseCase.escopoDe(await repos.usuario.buscarPorId(eu));

    for (const exclusao of pacote.exclusoes) {
      if (exclusao.tabela === 'enderecos') await repos.endereco.excluir(exclusao.registroId);
      if (exclusao.tabela === 'padroes') await repos.padrao.excluir(exclusao.registroId);
      if (exclusao.tabela === 'usuarios') await repos.usuario.excluir(exclusao.registroId);
    }

    for (const empresa of pacote.empresas) await repos.empresa.salvar(empresa);
    for (const endereco of pacote.enderecos) await repos.endereco.salvar(endereco);

    for (const padrao of pacote.padroes) {
      if (await repos.endereco.buscarPorId(padrao.enderecoId)) {
        await repos.padrao.salvar(padrao);
      } else {
        ignorados.push(`Padrão ${padrao.numero}: o endereço dele não está neste aparelho`);
      }
    }

    await this.aplicarUsuarios(pacote.usuarios, repos);

    // Não vigentes primeiro: liberam a vaga do dia antes de a vigente entrar.
    const leituras = [...pacote.leituras].sort(
      (a, b) => Number(a.estaVigente()) - Number(b.estaVigente()),
    );
    for (const leitura of leituras) {
      await this.aplicarLeitura(leitura, repos, ignorados);
    }

    for (const notificacao of pacote.notificacoes) {
      await this.aplicarNotificacao(notificacao, repos);
    }

    const escopoDepois = BaixarAlteracoesUseCase.escopoDe(await repos.usuario.buscarPorId(eu));
    return escopoAntes !== null && escopoAntes !== escopoDepois;
  }

  /** Resumo do que define o alcance do usuário: nível, empresa e vínculos. */
  private static escopoDe(usuario: Usuario | null): string | null {
    if (!usuario) return null;
    const vinculos = usuario.enderecosVinculados.map((e) => e.value).sort();
    return [usuario.perfil, usuario.empresaId?.value ?? '', ...vinculos].join('|');
  }

  /**
   * Em duas passadas, porque `autorizado_por` aponta para outro usuário que
   * pode vir depois no mesmo pacote — ou nem vir, quando quem autorizou está
   * fora do alcance de quem está baixando. Nesse caso o campo fica nulo no
   * aparelho; o valor de verdade continua na nuvem.
   */
  private async aplicarUsuarios(
    usuarios: Usuario[],
    repos: RepositoriosDaTransacao,
  ): Promise<void> {
    const prontos: { usuario: Usuario; vinculos: UUIDv4[] }[] = [];

    for (const usuario of usuarios) {
      if (usuario.empresaId && !(await repos.empresa.buscarPorId(usuario.empresaId))) continue;

      const vinculos: UUIDv4[] = [];
      for (const enderecoId of usuario.enderecosVinculados) {
        if (await repos.endereco.buscarPorId(enderecoId)) vinculos.push(enderecoId);
      }

      await repos.usuario.salvar(BaixarAlteracoesUseCase.copiaDe(usuario, vinculos, null));
      prontos.push({ usuario, vinculos });
    }

    for (const { usuario, vinculos } of prontos) {
      const autorizador = usuario.autorizadoPorId;
      if (autorizador && (await repos.usuario.buscarPorId(autorizador))) {
        await repos.usuario.salvar(BaixarAlteracoesUseCase.copiaDe(usuario, vinculos, autorizador));
      }
    }
  }

  private static copiaDe(
    usuario: Usuario,
    vinculos: UUIDv4[],
    autorizadoPorId: UUIDv4 | null,
  ): Usuario {
    return new Usuario({
      id: usuario.id,
      empresaId: usuario.empresaId,
      nome: usuario.nome,
      usuario: usuario.usuario,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
      enderecosVinculados: vinculos,
      perfilAnterior: usuario.perfilAnterior,
      criadoEm: usuario.criadoEm,
      autorizadoEm: usuario.autorizadoEm,
      autorizadoPorId,
    });
  }

  private async aplicarLeitura(
    remota: Leitura,
    repos: RepositoriosDaTransacao,
    ignorados: string[],
  ): Promise<void> {
    const local = await repos.leitura.buscarPorId(remota.id);
    // Alteração local ainda não enviada: quem resolve é o envio dela.
    if (local && !local.estaSincronizada()) return;

    if (!(await repos.padrao.buscarPorId(remota.padraoId))) {
      ignorados.push(`Leitura ${remota.id.value}: o padrão dela não está neste aparelho`);
      return;
    }
    if (!(await repos.usuario.buscarPorId(remota.usuarioId))) {
      ignorados.push(`Leitura ${remota.id.value}: o autor dela não está neste aparelho`);
      return;
    }

    const decididaPorId =
      remota.decididaPorId && (await repos.usuario.buscarPorId(remota.decididaPorId))
        ? remota.decididaPorId
        : null;

    await repos.leitura.aplicarRemota(
      new Leitura({
        id: remota.id,
        padraoId: remota.padraoId,
        usuarioId: remota.usuarioId,
        valorConsumo: remota.valorConsumo,
        valorInjecao: remota.valorInjecao,
        fotoLocalUri: remota.fotoLocalUri,
        fotoRemotaPath: remota.fotoRemotaPath,
        coordenadas: remota.coordenadas,
        medidoEm: remota.medidoEm,
        dataLocal: remota.dataLocal,
        status: remota.status,
        estadoSync: EstadoSyncEnum.SINCRONIZADA,
        substituidaEm: remota.substituidaEm,
        substituidaPorId: remota.substituidaPorId,
        decididaEm: remota.decididaEm,
        decididaPorId,
      }),
    );
  }

  private async aplicarNotificacao(
    remota: Notificacao,
    repos: RepositoriosDaTransacao,
  ): Promise<void> {
    // Aviso de uma leitura que não está neste aparelho (já expurgada, por
    // exemplo) não tem como ser mostrado nem decidido aqui.
    if (remota.leituraId && !(await repos.leitura.buscarPorId(remota.leituraId))) return;

    const resolvidaPorId =
      remota.resolvidaPorId && (await repos.usuario.buscarPorId(remota.resolvidaPorId))
        ? remota.resolvidaPorId
        : null;

    await repos.notificacao.salvar(
      new Notificacao({
        id: remota.id,
        empresaId: remota.empresaId,
        tipo: remota.tipo,
        titulo: remota.titulo,
        mensagem: remota.mensagem,
        criadaEm: remota.criadaEm,
        requerAcao: remota.requerAcao,
        leituraId: remota.leituraId,
        lida: remota.lida,
        resolucao: remota.resolucao,
        resolvidaEm: remota.resolvidaEm,
        resolvidaPorId,
      }),
    );
  }
}
