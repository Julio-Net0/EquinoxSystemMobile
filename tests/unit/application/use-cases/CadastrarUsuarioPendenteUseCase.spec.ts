import { CadastrarUsuarioPendenteUseCase } from '@/application/use-cases/CadastrarUsuarioPendenteUseCase';
import { Empresa } from '@/domain/entities/Empresa';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';

const SENHA = 'Equinox@2026';

async function cenario() {
  const usuarioRepo = new UsuarioRepositoryMemory();
  const empresaRepo = new EmpresaRepositoryMemory();
  const hash = new HashSenhaFake();
  const caso = new CadastrarUsuarioPendenteUseCase(usuarioRepo, empresaRepo, hash);

  const empresa = new Empresa({
    id: UUIDv4.gerar(),
    nome: 'Equinox Energia Solar',
    cnpj: new CNPJ('19131243000197'),
  });
  await empresaRepo.salvar(empresa);

  const entrada = {
    empresaId: empresa.id.value,
    nome: 'Maria Souza',
    usuario: 'maria.souza',
    email: 'maria@equinox.dev',
    senha: SENHA,
    confirmacaoSenha: SENHA,
  };

  return { caso, usuarioRepo, empresa, entrada, hash };
}

describe('CadastrarUsuarioPendenteUseCase', () => {
  it('cria o usuário como Técnico pendente de autorização', async () => {
    const { caso, usuarioRepo, entrada } = await cenario();

    const saida = await caso.executar(entrada);

    expect(saida.sucesso).toBe(true);
    const criado = [...usuarioRepo.items.values()][0];
    expect(criado.status).toBe(StatusUsuarioEnum.PENDENTE);
    expect(criado.perfil).toBe(PerfilEnum.TECNICO);
    expect(criado.enderecosVinculados).toEqual([]);
  });

  it('guarda a senha hasheada, nunca em texto', async () => {
    const { caso, usuarioRepo, entrada, hash } = await cenario();

    await caso.executar(entrada);

    const criado = [...usuarioRepo.items.values()][0];
    expect(criado.senha.serializar()).not.toContain(SENHA);
    expect(await hash.verificar(SENHA, criado.senha)).toBe(true);
  });

  it('recusa quando a empresa não existe', async () => {
    const { caso, entrada } = await cenario();

    const saida = await caso.executar({ ...entrada, empresaId: UUIDv4.gerar().value });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toBe('Empresa não encontrada');
  });

  it('recusa e-mail já cadastrado', async () => {
    const { caso, usuarioRepo, entrada, hash } = await cenario();
    await usuarioRepo.salvar(
      new Usuario({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Outra Maria',
        usuario: 'outra.maria',
        email: 'maria@equinox.dev',
        senha: await hash.gerar('x'),
        perfil: PerfilEnum.TECNICO,
        status: StatusUsuarioEnum.ATIVO,
        enderecosVinculados: [UUIDv4.gerar()],
      }),
    );

    expect((await caso.executar(entrada)).erro).toBe('Este e-mail já está cadastrado');
  });

  it('recusa login já usado por outra pessoa', async () => {
    const { caso, usuarioRepo, entrada, hash } = await cenario();
    await usuarioRepo.salvar(
      new Usuario({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Maria Antiga',
        usuario: 'maria.souza',
        email: 'antiga@equinox.dev',
        senha: await hash.gerar('x'),
        perfil: PerfilEnum.TECNICO,
        status: StatusUsuarioEnum.ATIVO,
        enderecosVinculados: [UUIDv4.gerar()],
      }),
    );

    expect((await caso.executar(entrada)).erro).toBe('Este usuário já está em uso');
  });

  it.each([
    ['nome', { nome: '  ' }, 'Preencha todos os campos'],
    ['usuário', { usuario: '' }, 'Preencha todos os campos'],
    ['e-mail', { email: '' }, 'Preencha todos os campos'],
    ['senha', { senha: '' }, 'Preencha todos os campos'],
  ])('recusa %s vazio', async (_campo, sobrescrita, erro) => {
    const { caso, entrada } = await cenario();
    expect((await caso.executar({ ...entrada, ...sobrescrita })).erro).toBe(erro);
  });

  it('exige senha de ao menos 6 caracteres, como no app antigo', async () => {
    const { caso, entrada } = await cenario();
    const curta = { ...entrada, senha: '12345', confirmacaoSenha: '12345' };
    expect((await caso.executar(curta)).erro).toBe('A senha deve ter ao menos 6 caracteres');
  });

  it('exige que a confirmação coincida', async () => {
    const { caso, entrada } = await cenario();
    const saida = await caso.executar({ ...entrada, confirmacaoSenha: 'outra-coisa' });
    expect(saida.erro).toBe('As senhas não coincidem');
  });

  it('recusa e-mail mal formado', async () => {
    const { caso, entrada } = await cenario();
    expect((await caso.executar({ ...entrada, email: 'nao-e-email' })).erro).toBe(
      'O e-mail informado não parece válido',
    );
  });

  it('nada é gravado quando a validação falha', async () => {
    const { caso, usuarioRepo, entrada } = await cenario();
    await caso.executar({ ...entrada, senha: '123', confirmacaoSenha: '123' });
    expect(usuarioRepo.items.size).toBe(0);
  });
});
