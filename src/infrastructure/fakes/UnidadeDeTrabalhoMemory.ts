import {
  IUnidadeDeTrabalho,
  RepositoriosDaTransacao,
} from '@/domain/repositories/IUnidadeDeTrabalho';

/** Um dublê em memória guarda tudo num Map chamado `items`. */
interface ComItens {
  items: Map<string, unknown>;
}

/**
 * Unidade de trabalho dos testes. Tira uma cópia dos Maps antes da tarefa e a
 * devolve se a tarefa falhar — o suficiente para um teste de caso de uso
 * verificar o "tudo ou nada". A atomicidade de verdade é conferida contra o
 * SQLite, nos testes de integração.
 */
export class UnidadeDeTrabalhoMemory implements IUnidadeDeTrabalho {
  constructor(private readonly repos: RepositoriosDaTransacao) {}

  async executar<T>(tarefa: (repos: RepositoriosDaTransacao) => Promise<T>): Promise<T> {
    const guardados = Object.values(this.repos)
      .filter((repo): repo is ComItens => (repo as ComItens).items instanceof Map)
      .map((repo) => ({ repo, copia: new Map(repo.items) }));

    try {
      return await tarefa(this.repos);
    } catch (erro) {
      for (const { repo, copia } of guardados) repo.items = copia;
      throw erro;
    }
  }
}
