import { AutenticacaoSupabase } from '@/infrastructure/supabase/AutenticacaoSupabase';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { ERRO_DE_REDE, criarClienteFalso, sessaoDe } from '../../../helpers/clienteSupabaseFalso';
import { IDS } from '../../../helpers/cenarioSync';

const EMAIL = 'tecnico@equinox.dev';
const UID = IDS.tecnico.value;

function cenario() {
  const falso = criarClienteFalso();
  return { ...falso, gateway: new AutenticacaoSupabase(falso.cliente) };
}

const cadastro = {
  empresaId: IDS.empresa.value, nome: 'Maria Souza', usuario: 'maria.souza',
  email: 'maria@equinox.dev', senha: 'segredo1',
};

describe('AutenticacaoSupabase', () => {
  describe('entrar', () => {
    it('autentica por e-mail e senha no Supabase Auth', async () => {
      const { gateway, auth } = cenario();
      auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: UID, email: EMAIL } }, error: null,
      });

      const saida = await gateway.entrar(EMAIL, 'Equinox@2026');

      expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'Equinox@2026' });
      expect(saida).toEqual({ ok: true, valor: { usuarioId: UID, email: EMAIL } });
    });

    it('credencial errada é recusa', async () => {
      const { gateway, auth } = cenario();
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null }, error: { message: 'Invalid login credentials', status: 400 },
      });

      const saida = await gateway.entrar(EMAIL, 'errada');

      expect(saida).toMatchObject({ ok: false, motivo: 'rejeitado' });
    });

    it('falha de rede é reconhecida como rede, não como senha errada', async () => {
      const { gateway, auth } = cenario();
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 },
      });

      expect(await gateway.entrar(EMAIL, 'x')).toMatchObject({ ok: false, motivo: 'rede' });
    });

    it('exceção crua de rede também vira falha de rede', async () => {
      const { gateway, auth } = cenario();
      auth.signInWithPassword.mockRejectedValue(new TypeError('Network request failed'));

      expect(await gateway.entrar(EMAIL, 'x')).toMatchObject({ ok: false, motivo: 'rede' });
    });
  });

  describe('cadastrar', () => {
    it('envia só nome, usuário e empresa nos metadados — nunca nível ou status', async () => {
      const { gateway, auth } = cenario();
      auth.signUp.mockResolvedValue({
        data: { user: { id: UID, email: cadastro.email, identities: [{}] }, session: null },
        error: null,
      });

      const saida = await gateway.cadastrar(cadastro);

      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'maria@equinox.dev',
        password: 'segredo1',
        options: {
          data: { nome: 'Maria Souza', usuario: 'maria.souza', empresa_id: IDS.empresa.value },
        },
      });
      expect(saida).toEqual({ ok: true, valor: { usuarioId: UID, email: cadastro.email } });
    });

    it('se o cadastro devolver sessão, ela não fica no aparelho', async () => {
      const { gateway, auth } = cenario();
      auth.signUp.mockResolvedValue({
        data: { user: { id: UID, email: cadastro.email, identities: [{}] }, session: { access_token: 't' } },
        error: null,
      });

      await gateway.cadastrar(cadastro);

      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('usuário devolvido sem identidades é e-mail já cadastrado', async () => {
      const { gateway, auth } = cenario();
      auth.signUp.mockResolvedValue({
        data: { user: { id: UID, identities: [] }, session: null }, error: null,
      });

      expect(await gateway.cadastrar(cadastro)).toEqual({
        ok: false, motivo: 'rejeitado', mensagem: 'Este e-mail já está cadastrado',
      });
    });

    it.each([
      ['User already registered', 'Este e-mail já está cadastrado'],
      ['Database error saving new user', 'Não foi possível concluir o cadastro. Esse nome de usuário pode já estar em uso'],
      ['Password should be at least 6 characters', 'A senha não foi aceita. Use ao menos 6 caracteres'],
      ['Signups not allowed', 'Não foi possível concluir o cadastro: Signups not allowed'],
    ])('traduz a recusa "%s"', async (original, traduzida) => {
      const { gateway, auth } = cenario();
      auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: original, status: 422 } });

      expect(await gateway.cadastrar(cadastro)).toEqual({
        ok: false, motivo: 'rejeitado', mensagem: traduzida,
      });
    });

    it('sem rede', async () => {
      const { gateway, auth } = cenario();
      auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: ERRO_DE_REDE });

      expect(await gateway.cadastrar(cadastro)).toMatchObject({ ok: false, motivo: 'rede' });
    });
  });

  describe('buscarEmpresasParaCadastro', () => {
    it('usa a função restrita e devolve só id e nome', async () => {
      const { gateway, rpcs, responder } = cenario();
      responder('rpc:buscar_empresas_cadastro', {
        data: [{ id: IDS.empresa.value, nome: 'Equinox Energia Solar', cnpj: 'não deveria vir' }],
      });

      const saida = await gateway.buscarEmpresasParaCadastro('equi');

      expect(rpcs).toEqual([{ nome: 'buscar_empresas_cadastro', args: { p_termo: 'equi' } }]);
      expect(saida).toEqual({
        ok: true, valor: [{ id: IDS.empresa.value, nome: 'Equinox Energia Solar' }],
      });
    });

    it('nunca consulta a tabela de empresas diretamente', async () => {
      const { gateway, consultas } = cenario();
      await gateway.buscarEmpresasParaCadastro('');
      expect(consultas).toEqual([]);
    });

    it('erro do servidor vira falha', async () => {
      const { gateway, responder } = cenario();
      responder('rpc:buscar_empresas_cadastro', { error: ERRO_DE_REDE, status: 0 });

      expect(await gateway.buscarEmpresasParaCadastro('x')).toMatchObject({ ok: false, motivo: 'rede' });
    });
  });

  describe('obterMeuPerfil', () => {
    const linha = {
      id: UID, empresa_id: IDS.empresa.value, nome: 'João da Silva', usuario: 'tecnico',
      email: EMAIL, nivel_acesso: 2, nivel_anterior: 1, status: 'Ativo',
      criado_em: '2026-03-01T12:00:00+00:00', autorizado_em: '2026-03-02T12:00:00+00:00',
      autorizado_por: IDS.admin.value,
      usuario_enderecos: [{ endereco_id: IDS.endereco.value }],
    };

    it('lê o perfil do usuário da sessão, com os vínculos', async () => {
      const { gateway, auth, consultas, responder } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      responder('perfis:select', { data: linha });

      const saida = await gateway.obterMeuPerfil();

      expect(consultas[0]).toMatchObject({
        tabela: 'perfis', operacao: 'select', carga: '*, usuario_enderecos(endereco_id)',
      });
      expect(consultas[0].filtros).toContainEqual(['eq', 'id', UID]);
      const usuario = saida.ok ? saida.valor : null;
      expect(usuario?.perfil).toBe(PerfilEnum.ADMIN);
      expect(usuario?.perfilAnterior).toBe(PerfilEnum.TECNICO);
      expect(usuario?.status).toBe(StatusUsuarioEnum.ATIVO);
      expect(usuario?.enderecosVinculados.map((e) => e.value)).toEqual([IDS.endereco.value]);
      expect(usuario?.autorizadoPorId?.value).toBe(IDS.admin.value);
    });

    it('conta sem perfil devolve nulo', async () => {
      const { gateway, auth, responder } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      responder('perfis:select', { data: null });

      expect(await gateway.obterMeuPerfil()).toEqual({ ok: true, valor: null });
    });

    it('sem sessão não consulta nada', async () => {
      const { gateway, consultas } = cenario();

      expect(await gateway.obterMeuPerfil()).toMatchObject({ ok: false, motivo: 'nao_autenticado' });
      expect(consultas).toEqual([]);
    });

    it('token recusado pelo banco é sessão expirada', async () => {
      const { gateway, auth, responder } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      responder('perfis:select', { error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 });

      expect(await gateway.obterMeuPerfil()).toMatchObject({ ok: false, motivo: 'nao_autenticado' });
    });
  });

  describe('alterarSenha', () => {
    it('confere a senha atual com um novo login e só então grava a nova', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      auth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID } }, error: null });

      const saida = await gateway.alterarSenha('atual', 'NovaSenha@1');

      expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'atual' });
      expect(auth.updateUser).toHaveBeenCalledWith({ password: 'NovaSenha@1' });
      expect(saida).toEqual({ ok: true, valor: undefined });
    });

    it('senha atual errada não troca nada', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null }, error: { message: 'Invalid login credentials', status: 400 },
      });

      const saida = await gateway.alterarSenha('errada', 'NovaSenha@1');

      expect(saida).toEqual({ ok: false, motivo: 'rejeitado', mensagem: 'A senha atual está incorreta' });
      expect(auth.updateUser).not.toHaveBeenCalled();
    });

    it('sem rede na conferência', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: ERRO_DE_REDE });

      expect(await gateway.alterarSenha('a', 'b')).toMatchObject({ ok: false, motivo: 'rede' });
    });

    it('falha na gravação da senha nova', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);
      auth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID } }, error: null });
      auth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'Senha fraca', status: 422 } } as never);
      expect(await gateway.alterarSenha('a', 'b')).toEqual({
        ok: false, motivo: 'rejeitado', mensagem: 'Senha fraca',
      });

      auth.updateUser.mockResolvedValueOnce({ data: {}, error: ERRO_DE_REDE } as never);
      expect(await gateway.alterarSenha('a', 'b')).toMatchObject({ ok: false, motivo: 'rede' });
    });

    it('sem sessão', async () => {
      const { gateway } = cenario();
      expect(await gateway.alterarSenha('a', 'b')).toMatchObject({ ok: false, motivo: 'nao_autenticado' });
    });
  });

  describe('garantirSessao', () => {
    it('devolve a identidade quando há sessão válida (renovada se preciso)', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue(sessaoDe(UID, EMAIL) as never);

      expect(await gateway.garantirSessao()).toEqual({ ok: true, valor: { usuarioId: UID, email: EMAIL } });
    });

    it('sem sessão guardada devolve nulo', async () => {
      const { gateway } = cenario();
      expect(await gateway.garantirSessao()).toEqual({ ok: true, valor: null });
    });

    it('renovação que falha por rede não é sessão expirada', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue({
        data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'fetch failed' },
      } as never);

      expect(await gateway.garantirSessao()).toMatchObject({ ok: false, motivo: 'rede' });
    });

    it('token de renovação recusado é sessão expirada', async () => {
      const { gateway, auth } = cenario();
      auth.getSession.mockResolvedValue({
        data: { session: null }, error: { message: 'Invalid Refresh Token: Already Used', status: 400 },
      } as never);

      expect(await gateway.garantirSessao()).toMatchObject({ ok: false, motivo: 'nao_autenticado' });
    });
  });

  describe('sair', () => {
    it('revoga a sessão no servidor', async () => {
      const { gateway, auth } = cenario();

      await gateway.sair();

      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(auth.signOut).toHaveBeenCalledWith();
    });

    it('sem rede, apaga os tokens do aparelho mesmo assim', async () => {
      const { gateway, auth } = cenario();
      auth.signOut.mockResolvedValueOnce({ error: ERRO_DE_REDE } as never);

      await gateway.sair();

      expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    });

    it('nunca lança, nem quando tudo falha', async () => {
      const { gateway, auth } = cenario();
      auth.signOut.mockRejectedValue(new Error('cofre indisponível'));

      await expect(gateway.sair()).resolves.toBeUndefined();
      expect(auth.signOut).toHaveBeenCalledTimes(2);
    });
  });
});
