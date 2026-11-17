import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import {
  IUnidadeDeTrabalho,
  RepositoriosDaTransacao,
} from '@/domain/repositories/IUnidadeDeTrabalho';
import { ActionQueueItem, TipoOperacaoActionQueue } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { IRelogio } from '@/domain/services/Relogio';

export interface RepositoriosComFila {
  empresa: IEmpresaRepository;
  endereco: IEnderecoRepository;
  padrao: IPadraoRepository;
  leitura: ILeituraRepository;
  usuario: IUsuarioRepository;
  notificacao: INotificacaoRepository;
}

/**
 * Copia os métodos do repositório para um objeto simples, já ligados à
 * instância original. É a base sobre a qual as escritas são trocadas.
 */
function ligar<T extends object>(alvo: T): T {
  const copia: Record<string, unknown> = {};
  let prototipo: object | null = alvo;

  while (prototipo && prototipo !== Object.prototype) {
    for (const nome of Object.getOwnPropertyNames(prototipo)) {
      const valor = (alvo as Record<string, unknown>)[nome];
      if (nome !== 'constructor' && typeof valor === 'function' && !(nome in copia)) {
        copia[nome] = (valor as (...args: unknown[]) => unknown).bind(alvo);
      }
    }
    prototipo = Object.getPrototypeOf(prototipo) as object | null;
  }

  return copia as T;
}

/**
 * Envolve os repositórios para que TODA escrita local deixe um item na fila de
 * envio, na mesma transação (padrão *transactional outbox*).
 *
 * É aqui, e não em cada caso de uso, que a sincronização entra: os casos de
 * uso continuam dizendo "salve esta leitura" e recebem, sem saber, um
 * repositório que salva e enfileira. Um caminho só para leitura, decisão,
 * estrutura, usuários e notificações — mais simples de testar e de explicar do
 * que um caminho por operação.
 *
 * As leituras (consultas) passam direto para o repositório cru. E quem aplica
 * dados vindos da nuvem (o pull) usa os repositórios crus de propósito: o que
 * veio do servidor não deve voltar para a fila.
 */
export function repositoriosComFila(
  crus: RepositoriosDaTransacao,
  unidadeDeTrabalho: IUnidadeDeTrabalho,
  relogio: IRelogio,
  /** Chamado depois de cada escrita confirmada, para quem quiser sincronizar logo. */
  aoEnfileirar: () => void = () => undefined,
): RepositoriosComFila {
  type Entrada = [TipoOperacaoActionQueue, UUIDv4 | null];

  /** Executa a escrita e enfileira os envios, tudo ou nada. */
  const gravar = async (
    escrita: (repos: RepositoriosDaTransacao) => Promise<void>,
    ...entradas: Entrada[]
  ): Promise<void> => {
    await unidadeDeTrabalho.executar(async (repos) => {
      await escrita(repos);
      const agora = relogio.agora();
      for (const [tipo, registroId] of entradas) {
        await repos.actionQueue.enfileirar(ActionQueueItem.para(tipo, registroId, agora));
      }
    });
    // Só depois do commit: avisar antes faria alguém ler uma fila ainda vazia.
    aoEnfileirar();
  };

  return {
    empresa: {
      ...ligar(crus.empresa),
      salvar: (empresa) => gravar((r) => r.empresa.salvar(empresa), ['UPSERT_EMPRESA', empresa.id]),
    },

    endereco: {
      ...ligar(crus.endereco),
      salvar: (endereco) =>
        gravar((r) => r.endereco.salvar(endereco), ['UPSERT_ENDERECO', endereco.id]),
      atualizar: (endereco) =>
        gravar((r) => r.endereco.atualizar(endereco), ['UPSERT_ENDERECO', endereco.id]),
      excluir: (id) => gravar((r) => r.endereco.excluir(id), ['EXCLUIR_ENDERECO', id]),
    },

    padrao: {
      ...ligar(crus.padrao),
      salvar: (padrao) => gravar((r) => r.padrao.salvar(padrao), ['UPSERT_PADRAO', padrao.id]),
      atualizar: (padrao) =>
        gravar((r) => r.padrao.atualizar(padrao), ['UPSERT_PADRAO', padrao.id]),
      excluir: (id) => gravar((r) => r.padrao.excluir(id), ['EXCLUIR_PADRAO', id]),
    },

    usuario: {
      ...ligar(crus.usuario),
      salvar: (usuario) => gravar((r) => r.usuario.salvar(usuario), ['UPSERT_USUARIO', usuario.id]),
      atualizar: (usuario) =>
        gravar((r) => r.usuario.atualizar(usuario), ['UPSERT_USUARIO', usuario.id]),
      excluir: (id) => gravar((r) => r.usuario.excluir(id), ['EXCLUIR_USUARIO', id]),
    },

    leitura: {
      ...ligar(crus.leitura),
      salvar: (leitura) => {
        leitura.marcarPendenteDeEnvio();
        return gravar((r) => r.leitura.salvar(leitura), ['UPSERT_LEITURA', leitura.id]);
      },
      atualizar: (leitura) => {
        leitura.marcarPendenteDeEnvio();
        return gravar((r) => r.leitura.atualizar(leitura), ['UPSERT_LEITURA', leitura.id]);
      },
      // A antiga sobe primeiro, já como substituída, e libera a vaga do dia na
      // nuvem; só então a nova entra — a mesma ordem que o índice único exige
      // no SQLite.
      salvarSubstituindo: (nova, vigente) => {
        nova.marcarPendenteDeEnvio();
        vigente.marcarPendenteDeEnvio();
        return gravar(
          (r) => r.leitura.salvarSubstituindo(nova, vigente),
          ['UPSERT_LEITURA', vigente.id],
          ['UPSERT_LEITURA', nova.id],
        );
      },
    },

    notificacao: {
      ...ligar(crus.notificacao),
      salvar: (notificacao) =>
        gravar((r) => r.notificacao.salvar(notificacao), ['UPSERT_NOTIFICACAO', notificacao.id]),
      salvarVarias: (notificacoes) =>
        gravar(
          (r) => r.notificacao.salvarVarias(notificacoes),
          ...notificacoes.map((n): Entrada => ['UPSERT_NOTIFICACAO', n.id]),
        ),
      atualizar: (notificacao) =>
        gravar(
          (r) => r.notificacao.atualizar(notificacao),
          ['UPSERT_NOTIFICACAO', notificacao.id],
        ),
      marcarTodasLidas: (empresaId) =>
        gravar(
          (r) => r.notificacao.marcarTodasLidas(empresaId),
          ['MARCAR_NOTIFICACOES_LIDAS', empresaId],
        ),
    },
  };
}
