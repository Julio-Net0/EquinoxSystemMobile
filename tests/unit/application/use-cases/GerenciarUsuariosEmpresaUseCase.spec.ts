import { GerenciarUsuariosEmpresaUseCase } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { Usuario } from '@/domain/entities/Usuario';
import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { relogioFixo } from '@/domain/services/Relogio';

const AGORA = new Date(Date.UTC(2026, 2, 10, 15));
const hash = new HashSenhaFake();

async function usuario(
  empresaId: UUIDv4 | null,
  nome: string,
  login: string,
  perfil: PerfilEnum,
  status: StatusUsuarioEnum,
  enderecos: UUIDv4[] = [],
) {
  return new Usuario({
    id: UUIDv4.gerar(), empresaId, nome, usuario: login,
    email: `${login}@equinox.dev`, senha: await hash.gerar('Equinox@2026'),
    perfil, status, enderecosVinculados: enderecos,
  });
}

async function cenario() {
  const usuarioRepo = new UsuarioRepositoryMemory();
  const enderecoRepo = new EnderecoRepositoryMemory();
  const caso = new GerenciarUsuariosEmpresaUseCase(usuarioRepo, enderecoRepo, relogioFixo(AGORA));

  const empresaId = UUIDv4.gerar();
  const endereco = new Endereco({ id: UUIDv4.gerar(), empresaId, apelido: 'Sede', uc: '300111' });
  await enderecoRepo.salvar(endereco);

  const admin = await usuario(empresaId, 'Admin', 'admin', PerfilEnum.ADMIN, StatusUsuarioEnum.ATIVO, [endereco.id]);
  const tecnico = await usuario(empresaId, 'João da Silva', 'joao', PerfilEnum.TECNICO, StatusUsuarioEnum.ATIVO, [endereco.id]);
  const pendente = await usuario(empresaId, 'Maria Souza', 'maria', PerfilEnum.TECNICO, StatusUsuarioEnum.PENDENTE);
  const recusado = await usuario(empresaId, 'Pedro Lima', 'pedro', PerfilEnum.TECNICO, StatusUsuarioEnum.RECUSADO, [endereco.id]);
  for (const u of [admin, tecnico, pendente, recusado]) await usuarioRepo.salvar(u);

  return { caso, usuarioRepo, admin, tecnico, pendente, recusado, endereco, empresaId };
}

describe('GerenciarUsuariosEmpresaUseCase', () => {
  describe('listar', () => {
    it('lista os usuários da empresa do administrador', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.listar({ atorId: admin.id.value });
      expect(saida.usuarios).toHaveLength(4);
    });

    it('filtra por status', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.listar({ atorId: admin.id.value, status: StatusUsuarioEnum.PENDENTE });
      expect(saida.usuarios.map((u) => u.nome)).toEqual(['Maria Souza']);
    });

    it('busca por nome, e-mail ou login', async () => {
      const { caso, admin } = await cenario();
      expect((await caso.listar({ atorId: admin.id.value, termoBusca: 'souza' })).usuarios).toHaveLength(1);
      expect((await caso.listar({ atorId: admin.id.value, termoBusca: 'joao@' })).usuarios).toHaveLength(1);
    });

    it('devolve o resumo com os endereços vinculados', async () => {
      const { caso, admin, tecnico } = await cenario();
      const saida = await caso.listar({ atorId: admin.id.value, termoBusca: 'joao' });
      const resumo = saida.usuarios[0];
      expect(resumo.usuarioId).toBe(tecnico.id.value);
      expect(resumo.enderecos).toEqual([{ apelido: 'Sede', uc: '300111' }]);
    });

    it('nunca expõe o hash da senha no resumo', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.listar({ atorId: admin.id.value });
      expect(JSON.stringify(saida)).not.toContain('fake-sha');
    });

    it('recusa quando o perfil não administra', async () => {
      const { caso, tecnico } = await cenario();
      const saida = await caso.listar({ atorId: tecnico.id.value });
      expect(saida.erro).toBe('Seu perfil não permite administrar usuários');
      expect(saida.usuarios).toEqual([]);
    });
  });

  describe('atualizar', () => {
    it('altera nome, e-mail, perfil, status e vínculos', async () => {
      const { caso, usuarioRepo, admin, tecnico, endereco } = await cenario();

      const saida = await caso.atualizar({
        atorId: admin.id.value, usuarioId: tecnico.id.value,
        nome: 'João S. Silva', email: 'joao.novo@equinox.dev',
        perfil: PerfilEnum.ADMIN, status: StatusUsuarioEnum.ATIVO,
        enderecoIds: [endereco.id.value],
      });

      expect(saida.sucesso).toBe(true);
      const salvo = await usuarioRepo.buscarPorId(tecnico.id);
      expect(salvo?.nome).toBe('João S. Silva');
      expect(salvo?.email).toBe('joao.novo@equinox.dev');
      expect(salvo?.perfil).toBe(PerfilEnum.ADMIN);
    });

    it('recusa ativar sem endereço quem não é super admin', async () => {
      const { caso, admin, tecnico } = await cenario();

      const saida = await caso.atualizar({
        atorId: admin.id.value, usuarioId: tecnico.id.value,
        nome: 'João', email: 'joao@equinox.dev',
        perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO, enderecoIds: [],
      });

      expect(saida.erro).toBe('Selecione ao menos um endereço (perfis Usuário e Administrador)');
    });

    it('aceita deixar sem endereço quem não está ativo', async () => {
      const { caso, admin, tecnico } = await cenario();

      const saida = await caso.atualizar({
        atorId: admin.id.value, usuarioId: tecnico.id.value,
        nome: 'João', email: 'joao@equinox.dev',
        perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.INATIVO, enderecoIds: [],
      });

      expect(saida.sucesso).toBe(true);
    });

    it('recusa nome ou e-mail vazios', async () => {
      const { caso, admin, tecnico, endereco } = await cenario();
      const saida = await caso.atualizar({
        atorId: admin.id.value, usuarioId: tecnico.id.value,
        nome: '  ', email: 'joao@equinox.dev',
        perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
        enderecoIds: [endereco.id.value],
      });
      expect(saida.erro).toBe('Preencha nome e e-mail');
    });

    it('recusa um e-mail já usado por outro usuário', async () => {
      const { caso, admin, tecnico, endereco } = await cenario();
      const saida = await caso.atualizar({
        atorId: admin.id.value, usuarioId: tecnico.id.value,
        nome: 'João', email: 'maria@equinox.dev',
        perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
        enderecoIds: [endereco.id.value],
      });
      expect(saida.erro).toBe('Este e-mail já está em uso por outro usuário');
    });
  });

  describe('alternarStatus', () => {
    it('inativa quem está ativo', async () => {
      const { caso, usuarioRepo, admin, tecnico } = await cenario();
      await caso.alternarStatus({ atorId: admin.id.value, usuarioId: tecnico.id.value });
      expect((await usuarioRepo.buscarPorId(tecnico.id))?.status).toBe(StatusUsuarioEnum.INATIVO);
    });

    it('reativa quem está inativo, se tiver endereço', async () => {
      const { caso, usuarioRepo, admin, tecnico } = await cenario();
      await caso.alternarStatus({ atorId: admin.id.value, usuarioId: tecnico.id.value });
      await caso.alternarStatus({ atorId: admin.id.value, usuarioId: tecnico.id.value });
      expect((await usuarioRepo.buscarPorId(tecnico.id))?.status).toBe(StatusUsuarioEnum.ATIVO);
    });

    it('não deixa o administrador inativar a própria conta', async () => {
      const { caso, admin } = await cenario();
      const saida = await caso.alternarStatus({ atorId: admin.id.value, usuarioId: admin.id.value });
      expect(saida.erro).toBe('Você não pode alterar o seu próprio acesso');
    });
  });

  describe('aprovarRapido', () => {
    it('reaprova um recusado reusando perfil e endereços anteriores', async () => {
      const { caso, usuarioRepo, admin, recusado } = await cenario();

      const saida = await caso.aprovarRapido({ atorId: admin.id.value, usuarioId: recusado.id.value });

      expect(saida.sucesso).toBe(true);
      const salvo = await usuarioRepo.buscarPorId(recusado.id);
      expect(salvo?.status).toBe(StatusUsuarioEnum.ATIVO);
      expect(salvo?.enderecosVinculados).toHaveLength(1);
    });

    it('pede edição manual quando não há endereço para reusar', async () => {
      const { caso, admin, pendente } = await cenario();
      const saida = await caso.aprovarRapido({ atorId: admin.id.value, usuarioId: pendente.id.value });
      expect(saida.erro).toBe('Vincule ao menos um endereço pela edição para aprovar');
    });
  });

  describe('excluir', () => {
    it('remove o usuário', async () => {
      const { caso, usuarioRepo, admin, tecnico } = await cenario();
      await caso.excluir({ atorId: admin.id.value, usuarioId: tecnico.id.value });
      expect(await usuarioRepo.buscarPorId(tecnico.id)).toBeNull();
    });

    it('não deixa o administrador excluir a própria conta', async () => {
      const { caso, usuarioRepo, admin } = await cenario();
      const saida = await caso.excluir({ atorId: admin.id.value, usuarioId: admin.id.value });
      expect(saida.erro).toBe('Você não pode excluir a sua própria conta');
      expect(await usuarioRepo.buscarPorId(admin.id)).not.toBeNull();
    });
  });
});
