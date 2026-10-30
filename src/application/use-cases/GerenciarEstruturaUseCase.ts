import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export interface CoordenadasInput {
  latitude: number;
  longitude: number;
  precisaoMetros?: number;
}

export interface CamposEndereco {
  apelido: string;
  uc: string;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  ehUsina?: boolean;
  coordenadas?: CoordenadasInput | null;
}

export interface EnderecoEstruturaDTO {
  enderecoId: string;
  empresaId: string;
  apelido: string;
  uc: string;
  ehUsina: boolean;
  logradouro: string;
  temGeocerca: boolean;
  totalPadroes: number;
}

export interface ResultadoEstrutura {
  sucesso: boolean;
  erro?: string;
}

const SEM_PERMISSAO = 'Seu perfil não permite administrar a estrutura';
const FORA_DO_ESCOPO = 'Você só administra a estrutura da sua própria empresa';

/**
 * Administração de endereços e padrões — a tela "Gerenciar estrutura".
 *
 * Duas invariantes vindas do app antigo: todo endereço nasce com pelo menos um
 * padrão (um endereço sem padrão não tem o que ler), e a empresa de um endereço
 * nunca muda depois de criado.
 */
export class GerenciarEstruturaUseCase {
  constructor(
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly padraoRepo: IPadraoRepository,
    private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  public async listarEnderecos(entrada: {
    atorId: string;
    empresaId?: string;
  }): Promise<{ enderecos: EnderecoEstruturaDTO[]; erro?: string }> {
    const ator = await this.carregarAtor(entrada.atorId);
    if ('erro' in ator) return { enderecos: [], erro: ator.erro };

    const todos = await this.enderecoRepo.listarTodos();

    const visiveis = todos.filter((endereco) => {
      if (!ator.usuario.ehGlobal()) {
        return endereco.empresaId.equals(ator.usuario.empresaId as UUIDv4);
      }
      // Super admin vê tudo, e pode estreitar para uma empresa pela tela.
      return entrada.empresaId ? endereco.empresaId.value === entrada.empresaId : true;
    });

    const enderecos: EnderecoEstruturaDTO[] = [];
    for (const endereco of visiveis) {
      const padroes = await this.padraoRepo.listarPorEndereco(endereco.id);
      enderecos.push({
        enderecoId: endereco.id.value,
        empresaId: endereco.empresaId.value,
        apelido: endereco.apelido,
        uc: endereco.uc,
        ehUsina: endereco.ehUsina,
        logradouro: endereco.logradouro(),
        temGeocerca: endereco.temGeocerca(),
        totalPadroes: padroes.length,
      });
    }

    return { enderecos };
  }

  /** Padrões de um endereço, carregados sob demanda ao expandir o card. */
  public async listarPadroes(entrada: {
    enderecoId: string;
  }): Promise<{ padroes: { padraoId: string; numero: string }[] }> {
    const padroes = await this.padraoRepo.listarPorEndereco(new UUIDv4(entrada.enderecoId));

    return {
      padroes: padroes.map((p) => ({ padraoId: p.id.value, numero: p.numero })),
    };
  }

  public async criarEndereco(
    entrada: { atorId: string; empresaId: string; numerosDePadrao: string[] } & CamposEndereco,
  ): Promise<ResultadoEstrutura & { enderecoId?: string }> {
    const ator = await this.carregarAtor(entrada.atorId);
    if ('erro' in ator) return { sucesso: false, erro: ator.erro };

    const empresaId = new UUIDv4(entrada.empresaId);
    if (!this.noEscopo(ator.usuario, empresaId)) {
      return { sucesso: false, erro: FORA_DO_ESCOPO };
    }

    const invalido = GerenciarEstruturaUseCase.validarCampos(entrada);
    if (invalido) return { sucesso: false, erro: invalido };

    const numeros = entrada.numerosDePadrao.map((n) => n.trim()).filter((n) => n !== '');
    if (numeros.length === 0) {
      return { sucesso: false, erro: 'Informe ao menos um padrão Cemig' };
    }
    if (new Set(numeros).size !== numeros.length) {
      return { sucesso: false, erro: 'Há números de padrão repetidos' };
    }

    const endereco = new Endereco({
      id: UUIDv4.gerar(),
      empresaId,
      apelido: entrada.apelido,
      uc: entrada.uc,
      rua: entrada.rua,
      numero: entrada.numero,
      bairro: entrada.bairro,
      cidade: entrada.cidade,
      ehUsina: entrada.ehUsina,
      coordenadas: GerenciarEstruturaUseCase.paraCoordenadas(entrada.coordenadas),
    });

    await this.enderecoRepo.salvar(endereco);
    for (const numero of numeros) {
      await this.padraoRepo.salvar(
        new PadraoCemig({ id: UUIDv4.gerar(), enderecoId: endereco.id, numero }),
      );
    }

    return { sucesso: true, enderecoId: endereco.id.value };
  }

  public async atualizarEndereco(
    entrada: { atorId: string; enderecoId: string } & CamposEndereco,
  ): Promise<ResultadoEstrutura> {
    const contexto = await this.carregarEndereco(entrada.atorId, entrada.enderecoId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    const invalido = GerenciarEstruturaUseCase.validarCampos(entrada);
    if (invalido) return { sucesso: false, erro: invalido };

    const atual = contexto.endereco;
    const atualizado = new Endereco({
      id: atual.id,
      // A empresa do endereço nunca muda: mover um endereço de empresa levaria
      // com ele leituras e vínculos de usuário.
      empresaId: atual.empresaId,
      apelido: entrada.apelido,
      uc: entrada.uc,
      rua: entrada.rua,
      numero: entrada.numero,
      bairro: entrada.bairro,
      cidade: entrada.cidade,
      ehUsina: entrada.ehUsina ?? atual.ehUsina,
      coordenadas:
        GerenciarEstruturaUseCase.paraCoordenadas(entrada.coordenadas) ?? atual.coordenadas,
      criadoEm: atual.criadoEm,
    });

    await this.enderecoRepo.atualizar(atualizado);
    return { sucesso: true };
  }

  public async definirCoordenadas(entrada: {
    atorId: string;
    enderecoId: string;
    coordenadas: CoordenadasInput;
  }): Promise<ResultadoEstrutura> {
    const contexto = await this.carregarEndereco(entrada.atorId, entrada.enderecoId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    const coordenadas = GerenciarEstruturaUseCase.paraCoordenadas(entrada.coordenadas);
    if (!coordenadas) return { sucesso: false, erro: 'Coordenadas inválidas' };

    contexto.endereco.definirCoordenadas(coordenadas);
    await this.enderecoRepo.atualizar(contexto.endereco);
    return { sucesso: true };
  }

  public async excluirEndereco(entrada: {
    atorId: string;
    enderecoId: string;
  }): Promise<ResultadoEstrutura> {
    const contexto = await this.carregarEndereco(entrada.atorId, entrada.enderecoId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    // O SQLite cuida disto por cascade; aqui é explícito para o dublê em
    // memória se comportar igual.
    const padroes = await this.padraoRepo.listarPorEndereco(contexto.endereco.id);
    for (const padrao of padroes) await this.padraoRepo.excluir(padrao.id);

    await this.enderecoRepo.excluir(contexto.endereco.id);
    return { sucesso: true };
  }

  public async criarPadrao(entrada: {
    atorId: string;
    enderecoId: string;
    numero: string;
  }): Promise<ResultadoEstrutura & { padraoId?: string }> {
    const contexto = await this.carregarEndereco(entrada.atorId, entrada.enderecoId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    const numero = entrada.numero?.trim() ?? '';
    if (numero === '') return { sucesso: false, erro: 'Informe o número do padrão' };

    const existentes = await this.padraoRepo.listarPorEndereco(contexto.endereco.id);
    if (existentes.some((p) => p.numero === numero)) {
      return { sucesso: false, erro: 'Este endereço já tem um padrão com esse número' };
    }

    const padrao = new PadraoCemig({
      id: UUIDv4.gerar(),
      enderecoId: contexto.endereco.id,
      numero,
    });
    await this.padraoRepo.salvar(padrao);

    return { sucesso: true, padraoId: padrao.id.value };
  }

  public async atualizarPadrao(entrada: {
    atorId: string;
    padraoId: string;
    numero: string;
  }): Promise<ResultadoEstrutura> {
    const padrao = await this.padraoRepo.buscarPorId(new UUIDv4(entrada.padraoId));
    if (!padrao) return { sucesso: false, erro: 'Padrão não encontrado' };

    const contexto = await this.carregarEndereco(entrada.atorId, padrao.enderecoId.value);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    const numero = entrada.numero?.trim() ?? '';
    if (numero === '') return { sucesso: false, erro: 'Informe o número do padrão' };

    const irmaos = await this.padraoRepo.listarPorEndereco(padrao.enderecoId);
    if (irmaos.some((p) => p.numero === numero && !p.id.equals(padrao.id))) {
      return { sucesso: false, erro: 'Este endereço já tem um padrão com esse número' };
    }

    await this.padraoRepo.atualizar(
      new PadraoCemig({
        id: padrao.id,
        enderecoId: padrao.enderecoId,
        numero,
        criadoEm: padrao.criadoEm,
      }),
    );
    return { sucesso: true };
  }

  public async excluirPadrao(entrada: {
    atorId: string;
    padraoId: string;
  }): Promise<ResultadoEstrutura> {
    const padrao = await this.padraoRepo.buscarPorId(new UUIDv4(entrada.padraoId));
    if (!padrao) return { sucesso: false, erro: 'Padrão não encontrado' };

    const contexto = await this.carregarEndereco(entrada.atorId, padrao.enderecoId.value);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    const irmaos = await this.padraoRepo.listarPorEndereco(padrao.enderecoId);
    if (irmaos.length <= 1) {
      return { sucesso: false, erro: 'O endereço precisa de ao menos um padrão' };
    }

    await this.padraoRepo.excluir(padrao.id);
    return { sucesso: true };
  }

  private static validarCampos(campos: CamposEndereco): string | null {
    if (!campos.apelido || campos.apelido.trim() === '') return 'Informe o apelido do endereço';
    if (!campos.uc || campos.uc.trim() === '') return 'Informe a UC';
    return null;
  }

  private static paraCoordenadas(entrada?: CoordenadasInput | null): CoordenadasGPS | null {
    if (!entrada) return null;
    return new CoordenadasGPS(entrada.latitude, entrada.longitude, entrada.precisaoMetros);
  }

  private noEscopo(ator: Usuario, empresaId: UUIDv4): boolean {
    return ator.ehGlobal() || (ator.empresaId?.equals(empresaId) ?? false);
  }

  private async carregarAtor(atorId: string): Promise<{ usuario: Usuario } | { erro: string }> {
    const usuario = await this.usuarioRepo.buscarPorId(new UUIDv4(atorId));
    if (!usuario) return { erro: 'Sessão inválida. Entre de novo' };
    if (usuario.perfil === PerfilEnum.TECNICO) return { erro: SEM_PERMISSAO };
    return { usuario };
  }

  private async carregarEndereco(
    atorId: string,
    enderecoId: string,
  ): Promise<{ usuario: Usuario; endereco: Endereco } | { erro: string }> {
    const ator = await this.carregarAtor(atorId);
    if ('erro' in ator) return { erro: ator.erro };

    const endereco = await this.enderecoRepo.buscarPorId(new UUIDv4(enderecoId));
    if (!endereco) return { erro: 'Endereço não encontrado' };

    if (!this.noEscopo(ator.usuario, endereco.empresaId)) return { erro: FORA_DO_ESCOPO };

    return { usuario: ator.usuario, endereco };
  }
}
