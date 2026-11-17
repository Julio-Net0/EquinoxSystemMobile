import { CadastrarUsuarioPendenteUseCase } from '@/application/use-cases/CadastrarUsuarioPendenteUseCase';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { AutenticacaoRemotaFake } from '@/infrastructure/fakes/AutenticacaoRemotaFake';
import { IDS, SENHA, novoUsuario } from '../../../helpers/cenarioSync';

function cenario() {
  const remoto = new AutenticacaoRemotaFake();
  remoto.empresas = [
    { id: IDS.empresa.value, nome: 'Equinox Energia Solar' },
    { id: IDS.outraEmpresa.value, nome: 'Condomínio Solar do Vale' },
  ];
  return { remoto, caso: new CadastrarUsuarioPendenteUseCase(remoto) };
}

const entrada = (sobrescrita: Record<string, string> = {}) => ({
  empresaId: IDS.empresa.value,
  nome: 'Maria Souza',
  usuario: 'Maria.Souza',
  email: 'Maria@Equinox.dev',
  senha: 'segredo1',
  confirmacaoSenha: 'segredo1',
  ...sobrescrita,
});

describe('CadastrarUsuarioPendenteUseCase', () => {
  it('cadastra na nuvem, com e-mail e usuário normalizados', async () => {
    const { caso, remoto } = cenario();

    const saida = await caso.executar(entrada());

    expect(saida.sucesso).toBe(true);
    expect(saida.usuarioId).toBeDefined();
    expect(remoto.cadastros).toEqual([
      {
        empresaId: IDS.empresa.value,
        nome: 'Maria Souza',
        usuario: 'maria.souza',
        email: 'maria@equinox.dev',
        senha: 'segredo1',
      },
    ]);
  });

  it('não envia nível nem status: quem os fixa é o servidor', async () => {
    const { caso, remoto } = cenario();

    await caso.executar(entrada());

    expect(Object.keys(remoto.cadastros[0]).sort()).toEqual([
      'email', 'empresaId', 'nome', 'senha', 'usuario',
    ]);
  });

  it('o cadastro nasce Técnico e Pendente, e não deixa sessão aberta', async () => {
    const { caso, remoto } = cenario();
    await caso.executar(entrada());

    // O que a nuvem criou é o que o login vai encontrar.
    await remoto.entrar('maria@equinox.dev', 'segredo1');
    const perfil = await remoto.obterMeuPerfil();

    expect(perfil.ok && perfil.valor?.perfil).toBe(PerfilEnum.TECNICO);
    expect(perfil.ok && perfil.valor?.status).toBe(StatusUsuarioEnum.PENDENTE);
  });

  it('sem rede, explica que o cadastro precisa de internet', async () => {
    const { caso, remoto } = cenario();
    remoto.online = false;

    const saida = await caso.executar(entrada());

    expect(saida).toEqual({ sucesso: false, erro: 'Sem conexão. O cadastro precisa de internet' });
  });

  it('repassa a recusa da nuvem para e-mail já cadastrado', async () => {
    const { caso, remoto } = cenario();
    remoto.registrarConta(novoUsuario({ email: 'maria@equinox.dev' }), SENHA);

    const saida = await caso.executar(entrada());

    expect(saida).toEqual({ sucesso: false, erro: 'Este e-mail já está cadastrado' });
  });

  it('repassa a recusa da nuvem para usuário já em uso', async () => {
    const { caso, remoto } = cenario();
    remoto.registrarConta(novoUsuario({ usuario: 'maria.souza' }), SENHA);

    const saida = await caso.executar(entrada());

    expect(saida.erro).toBe('Este usuário já está em uso');
  });

  it.each(['nome', 'usuario', 'email', 'senha', 'empresaId'])(
    'recusa quando falta %s',
    async (campo) => {
      const { caso } = cenario();
      const saida = await caso.executar(entrada({ [campo]: '' }));
      expect(saida).toEqual({ sucesso: false, erro: 'Preencha todos os campos' });
    },
  );

  it('exige senha de ao menos 6 caracteres, como no app antigo', async () => {
    const { caso } = cenario();
    const saida = await caso.executar(entrada({ senha: '12345', confirmacaoSenha: '12345' }));
    expect(saida.erro).toBe('A senha deve ter ao menos 6 caracteres');
  });

  it('exige que a confirmação coincida', async () => {
    const { caso } = cenario();
    const saida = await caso.executar(entrada({ confirmacaoSenha: 'diferente' }));
    expect(saida.erro).toBe('As senhas não coincidem');
  });

  it('recusa e-mail mal formado', async () => {
    const { caso } = cenario();
    const saida = await caso.executar(entrada({ email: 'maria-sem-arroba' }));
    expect(saida.erro).toBe('O e-mail informado não parece válido');
  });

  it('nada vai para a nuvem quando a validação falha', async () => {
    const { caso, remoto } = cenario();
    await caso.executar(entrada({ confirmacaoSenha: 'diferente' }));
    expect(remoto.cadastros).toHaveLength(0);
  });

  describe('busca de empresa (antes do login)', () => {
    it('devolve só id e nome', async () => {
      const { caso } = cenario();

      const saida = await caso.buscarEmpresas('solar');

      expect(saida.erro).toBeUndefined();
      expect(saida.empresas).toHaveLength(2);
      expect(Object.keys(saida.empresas[0]).sort()).toEqual(['id', 'nome']);
    });

    it('filtra pelo termo', async () => {
      const { caso } = cenario();
      const saida = await caso.buscarEmpresas('vale');
      expect(saida.empresas.map((e) => e.nome)).toEqual(['Condomínio Solar do Vale']);
    });

    it('sem rede, devolve lista vazia e avisa', async () => {
      const { caso, remoto } = cenario();
      remoto.online = false;

      const saida = await caso.buscarEmpresas('');

      expect(saida.empresas).toEqual([]);
      expect(saida.erro).toContain('precisa de internet');
    });
  });
});
