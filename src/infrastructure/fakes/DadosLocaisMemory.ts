import { IDadosLocaisRepository } from '@/domain/repositories/IDadosLocaisRepository';
import { EmpresaRepositoryMemory } from './EmpresaRepositoryMemory';
import { EnderecoRepositoryMemory } from './EnderecoRepositoryMemory';
import { PadraoRepositoryMemory } from './PadraoRepositoryMemory';
import { LeituraRepositoryMemory } from './LeituraRepositoryMemory';
import { UsuarioRepositoryMemory } from './UsuarioRepositoryMemory';
import { NotificacaoRepositoryMemory } from './NotificacaoRepositoryMemory';

export interface RepositoriosEmMemoria {
  empresa: EmpresaRepositoryMemory;
  endereco: EnderecoRepositoryMemory;
  padrao: PadraoRepositoryMemory;
  leitura: LeituraRepositoryMemory;
  usuario: UsuarioRepositoryMemory;
  notificacao: NotificacaoRepositoryMemory;
}

export class DadosLocaisMemory implements IDadosLocaisRepository {
  private readonly repos: RepositoriosEmMemoria;

  constructor(repos: Partial<RepositoriosEmMemoria> = {}) {
    this.repos = {
      empresa: repos.empresa ?? new EmpresaRepositoryMemory(),
      endereco: repos.endereco ?? new EnderecoRepositoryMemory(),
      padrao: repos.padrao ?? new PadraoRepositoryMemory(),
      leitura: repos.leitura ?? new LeituraRepositoryMemory(),
      usuario: repos.usuario ?? new UsuarioRepositoryMemory(),
      notificacao: repos.notificacao ?? new NotificacaoRepositoryMemory(),
    };
  }

  async limparTudo(): Promise<string[]> {
    const fotos = Array.from(this.repos.leitura.items.values())
      .map((l) => l.fotoLocalUri)
      .filter((f) => f !== '');

    this.repos.notificacao.items.clear();
    this.repos.leitura.items.clear();
    this.repos.padrao.items.clear();
    this.repos.endereco.items.clear();
    this.repos.endereco.vinculos.clear();
    this.repos.usuario.items.clear();
    this.repos.empresa.items.clear();

    return fotos;
  }
}

