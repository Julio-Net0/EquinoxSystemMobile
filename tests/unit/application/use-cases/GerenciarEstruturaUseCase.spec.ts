import { GerenciarEstruturaUseCase } from '@/application/use-cases/GerenciarEstruturaUseCase';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';
import { PadraoRepositoryMemory } from '@/infrastructure/fakes/PadraoRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';

const empresaA = UUIDv4.gerar();
const empresaB = UUIDv4.gerar();

async function ator(perfil: PerfilEnum, empresaId: UUIDv4 | null, login: string) {
  return new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: login, usuario: login,
    email: `${login}@equinox.dev`, senha: await new HashSenhaFake().gerar('Equinox@2026'),
    perfil, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: perfil === PerfilEnum.SUPER_ADMIN ? [] : [UUIDv4.gerar()],
  });
}

async function cenario() {
  const enderecoRepo = new EnderecoRepositoryMemory();
  const padraoRepo = new PadraoRepositoryMemory();
  const usuarioRepo = new UsuarioRepositoryMemory();
  const caso = new GerenciarEstruturaUseCase(enderecoRepo, padraoRepo, usuarioRepo);

  const admin = await ator(PerfilEnum.ADMIN, empresaA, 'admin');
  const superAdmin = await ator(PerfilEnum.SUPER_ADMIN, null, 'super');
  const tecnico = await ator(PerfilEnum.TECNICO, empresaA, 'tecnico');
  for (const u of [admin, superAdmin, tecnico]) await usuarioRepo.salvar(u);

  const sede = new Endereco({
    id: UUIDv4.gerar(), empresaId: empresaA, apelido: 'Sede', uc: '300111',
  });
  const alheio = new Endereco({
    id: UUIDv4.gerar(), empresaId: empresaB, apelido: 'Sede B', uc: '300222',
  });
  await enderecoRepo.salvar(sede);
  await enderecoRepo.salvar(alheio);

  const padraoSede = new PadraoCemig({
    id: UUIDv4.gerar(), enderecoId: sede.id, numero: '778811',
  });
  await padraoRepo.salvar(padraoSede);

  return {
    caso, enderecoRepo, padraoRepo,
    admin, superAdmin, tecnico, sede, alheio, padraoSede,
  };
}

const camposEndereco = {
  apelido: 'Galpão novo',
  uc: '3009999999',
  rua: 'Rua das Flores',
  numero: '123',
  bairro: 'Centro',
  cidade: 'Belo Horizonte',
  ehUsina: false,
};

describe('GerenciarEstruturaUseCase', () => {
  describe('listarEnderecos', () => {
    it('o administrador vê só os da própria empresa', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.listarEnderecos({ atorId: admin.id.value });
      expect(saida.enderecos.map((e) => e.apelido)).toEqual(['Sede']);
    });

    it('o super admin vê os de todas', async () => {
      const { caso, superAdmin } = await cenario();
      expect((await caso.listarEnderecos({ atorId: superAdmin.id.value })).enderecos).toHaveLength(2);
    });

    it('o super admin pode filtrar por empresa', async () => {
      const { caso, superAdmin } = await cenario();
      const saida = await caso.listarEnderecos({
        atorId: superAdmin.id.value, empresaId: empresaB.value,
      });
      expect(saida.enderecos.map((e) => e.apelido)).toEqual(['Sede B']);
    });

    it('traz a contagem de padrões de cada endereço', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.listarEnderecos({ atorId: admin.id.value });
      expect(saida.enderecos[0].totalPadroes).toBe(1);
    });

    it('o técnico não administra a estrutura', async () => {
      const { caso, tecnico } = await cenario();
      const saida = await caso.listarEnderecos({ atorId: tecnico.id.value });
      expect(saida.erro).toBe('Seu perfil não permite administrar a estrutura');
    });
  });

  describe('criarEndereco', () => {
    it('cria o endereço junto com os padrões informados', async () => {
      const { caso, enderecoRepo, padraoRepo, admin } = await cenario();

      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaA.value,
        ...camposEndereco, numerosDePadrao: ['111', '222'],
      });

      expect(saida.sucesso).toBe(true);
      const criado = await enderecoRepo.buscarPorId(new UUIDv4(saida.enderecoId as string));
      expect(criado?.apelido).toBe('Galpão novo');
      expect(criado?.logradouro()).toBe('Rua das Flores, 123 · Centro · Belo Horizonte');
      expect(await padraoRepo.listarPorEndereco(criado!.id)).toHaveLength(2);
    });

    it('exige ao menos um padrão, como o app antigo', async () => {
      const { caso, enderecoRepo, admin } = await cenario();

      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaA.value,
        ...camposEndereco, numerosDePadrao: [],
      });

      expect(saida.erro).toBe('Informe ao menos um padrão Cemig');
      expect(enderecoRepo.items.size).toBe(2);
    });

    it('recusa padrões repetidos no mesmo endereço', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaA.value,
        ...camposEndereco, numerosDePadrao: ['111', '111'],
      });
      expect(saida.erro).toBe('Há números de padrão repetidos');
    });

    it.each([
      ['apelido', { apelido: '  ' }, 'Informe o apelido do endereço'],
      ['UC', { uc: '' }, 'Informe a UC'],
    ])('recusa %s vazio', async (_campo, sobrescrita, erro) => {
      const { caso, admin } = await cenario();
      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaA.value,
        ...camposEndereco, ...sobrescrita, numerosDePadrao: ['111'],
      });
      expect(saida.erro).toBe(erro);
    });

    it('o administrador não cria endereço em outra empresa', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaB.value,
        ...camposEndereco, numerosDePadrao: ['111'],
      });
      expect(saida.erro).toBe('Você só administra a estrutura da sua própria empresa');
    });

    it('guarda as coordenadas quando informadas', async () => {
      const { caso, enderecoRepo, admin } = await cenario();

      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaA.value, ...camposEndereco,
        coordenadas: { latitude: -19.9191, longitude: -43.9386 },
        numerosDePadrao: ['111'],
      });

      const criado = await enderecoRepo.buscarPorId(new UUIDv4(saida.enderecoId as string));
      expect(criado?.temGeocerca()).toBe(true);
    });

    it('endereço sem coordenada simplesmente não tem geocerca', async () => {
      const { caso, enderecoRepo, admin } = await cenario();
      const saida = await caso.criarEndereco({
        atorId: admin.id.value, empresaId: empresaA.value,
        ...camposEndereco, numerosDePadrao: ['111'],
      });
      const criado = await enderecoRepo.buscarPorId(new UUIDv4(saida.enderecoId as string));
      expect(criado?.temGeocerca()).toBe(false);
    });
  });

  describe('atualizarEndereco', () => {
    it('altera os campos e mantém a empresa', async () => {
      const { caso, enderecoRepo, admin, sede } = await cenario();

      const saida = await caso.atualizarEndereco({
        atorId: admin.id.value, enderecoId: sede.id.value,
        apelido: 'Sede renomeada', uc: '300111', ehUsina: true,
      });

      expect(saida.sucesso).toBe(true);
      const salvo = await enderecoRepo.buscarPorId(sede.id);
      expect(salvo?.apelido).toBe('Sede renomeada');
      expect(salvo?.ehUsina).toBe(true);
      expect(salvo?.empresaId.equals(empresaA)).toBe(true);
    });

    it('não deixa o administrador mexer em endereço de outra empresa', async () => {
      const { caso, admin, alheio } = await cenario();
      const saida = await caso.atualizarEndereco({
        atorId: admin.id.value, enderecoId: alheio.id.value, apelido: 'X', uc: '1',
      });
      expect(saida.erro).toBe('Você só administra a estrutura da sua própria empresa');
    });
  });

  describe('definirCoordenadas', () => {
    it('adota uma posição como geocerca do endereço', async () => {
      const { caso, enderecoRepo, admin, sede } = await cenario();

      await caso.definirCoordenadas({
        atorId: admin.id.value, enderecoId: sede.id.value,
        coordenadas: { latitude: -19.9191, longitude: -43.9386 },
      });

      expect((await enderecoRepo.buscarPorId(sede.id))?.temGeocerca()).toBe(true);
    });
  });

  describe('padrões', () => {
    it('acrescenta um padrão ao endereço', async () => {
      const { caso, padraoRepo, admin, sede } = await cenario();

      const saida = await caso.criarPadrao({
        atorId: admin.id.value, enderecoId: sede.id.value, numero: '999',
      });

      expect(saida.sucesso).toBe(true);
      expect(await padraoRepo.listarPorEndereco(sede.id)).toHaveLength(2);
    });

    it('recusa número repetido no mesmo endereço', async () => {
      const { caso, admin, sede } = await cenario();
      const saida = await caso.criarPadrao({
        atorId: admin.id.value, enderecoId: sede.id.value, numero: '778811',
      });
      expect(saida.erro).toBe('Este endereço já tem um padrão com esse número');
    });

    it('recusa número vazio', async () => {
      const { caso, admin, sede } = await cenario();
      const saida = await caso.criarPadrao({
        atorId: admin.id.value, enderecoId: sede.id.value, numero: '  ',
      });
      expect(saida.erro).toBe('Informe o número do padrão');
    });

    it('renomeia um padrão', async () => {
      const { caso, padraoRepo, admin, padraoSede } = await cenario();

      await caso.atualizarPadrao({
        atorId: admin.id.value, padraoId: padraoSede.id.value, numero: '778899',
      });

      expect((await padraoRepo.buscarPorId(padraoSede.id))?.numero).toBe('778899');
    });

    it('não deixa remover o último padrão: endereço sem padrão não é legível', async () => {
      const { caso, admin, padraoSede } = await cenario();
      const saida = await caso.excluirPadrao({
        atorId: admin.id.value, padraoId: padraoSede.id.value,
      });
      expect(saida.erro).toBe('O endereço precisa de ao menos um padrão');
    });

    it('remove um padrão quando sobra outro', async () => {
      const { caso, padraoRepo, admin, sede, padraoSede } = await cenario();
      await caso.criarPadrao({ atorId: admin.id.value, enderecoId: sede.id.value, numero: '999' });

      const saida = await caso.excluirPadrao({
        atorId: admin.id.value, padraoId: padraoSede.id.value,
      });

      expect(saida.sucesso).toBe(true);
      expect(await padraoRepo.listarPorEndereco(sede.id)).toHaveLength(1);
    });
  });

  describe('excluirEndereco', () => {
    it('remove o endereço e seus padrões', async () => {
      const { caso, enderecoRepo, padraoRepo, admin, sede } = await cenario();

      const saida = await caso.excluirEndereco({ atorId: admin.id.value, enderecoId: sede.id.value });

      expect(saida.sucesso).toBe(true);
      expect(await enderecoRepo.buscarPorId(sede.id)).toBeNull();
      expect(await padraoRepo.listarPorEndereco(sede.id)).toHaveLength(0);
    });
  });
});
