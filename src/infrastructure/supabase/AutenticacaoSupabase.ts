import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DadosDeCadastroRemoto,
  EmpresaParaCadastro,
  IAutenticacaoRemotaGateway,
  IdentidadeRemota,
} from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ResultadoRemoto, remotoFalhou, remotoOk } from '@/domain/gateways/ResultadoRemoto';
import { Usuario } from '@/domain/entities/Usuario';
import { ErroSupabase, ehErroDeRede, falhaDe, protegido } from './errosSupabase';
import { PerfilRemoto, usuarioDeRemoto } from './mapeadoresRemotos';

const SEM_REDE = 'Sem conexão com a nuvem';

/**
 * Autenticação pelo Supabase Auth (e-mail e senha).
 *
 * A senha trafega só entre este adaptador e o serviço, por HTTPS, e nunca é
 * gravada no aparelho. O que fica guardado são os tokens da sessão, e quem os
 * guarda é o próprio cliente do Supabase, no armazenamento seguro que recebeu
 * (`CofreSeguroEmPartes`).
 */
export class AutenticacaoSupabase implements IAutenticacaoRemotaGateway {
  constructor(private readonly cliente: SupabaseClient) {}

  entrar(email: string, senha: string): Promise<ResultadoRemoto<IdentidadeRemota>> {
    return protegido(async () => {
      const { data, error } = await this.cliente.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error || !data.user) {
        return ehErroDeRede(error)
          ? remotoFalhou('rede', SEM_REDE)
          : remotoFalhou('rejeitado', error?.message ?? 'Credenciais inválidas');
      }

      return remotoOk({ usuarioId: data.user.id, email: data.user.email ?? email });
    });
  }

  /**
   * O perfil é criado no banco por um gatilho, a partir destes metadados — e
   * o gatilho ignora qualquer nível ou status que venha aqui. O usuário nasce
   * técnico e pendente (ver supabase/migrations).
   */
  cadastrar(dados: DadosDeCadastroRemoto): Promise<ResultadoRemoto<IdentidadeRemota>> {
    return protegido(async () => {
      const { data, error } = await this.cliente.auth.signUp({
        email: dados.email,
        password: dados.senha,
        options: {
          data: { nome: dados.nome, usuario: dados.usuario, empresa_id: dados.empresaId },
        },
      });

      if (error) {
        if (ehErroDeRede(error)) return remotoFalhou('rede', SEM_REDE);
        return remotoFalhou('rejeitado', AutenticacaoSupabase.motivoDoCadastro(error));
      }

      // Com confirmação de e-mail ligada, o Supabase responde "sucesso" para um
      // e-mail que já existe (para não revelar contas) e devolve o usuário sem
      // identidades. Para quem está se cadastrando, o efeito é o mesmo.
      if (!data.user || data.user.identities?.length === 0) {
        return remotoFalhou('rejeitado', 'Este e-mail já está cadastrado');
      }

      // Sem confirmação de e-mail o cadastro já devolve sessão. O usuário
      // ainda está pendente de autorização, então ela não fica no aparelho.
      if (data.session) {
        await this.cliente.auth.signOut({ scope: 'local' });
      }

      return remotoOk({ usuarioId: data.user.id, email: data.user.email ?? dados.email });
    });
  }

  private static motivoDoCadastro(erro: ErroSupabase): string {
    const mensagem = erro.message ?? '';

    if (/already registered|already been registered/i.test(mensagem)) {
      return 'Este e-mail já está cadastrado';
    }
    if (/database error/i.test(mensagem)) {
      // O gatilho que cria o perfil falhou: na prática, nome de usuário
      // repetido (índice único) ou empresa que deixou de existir.
      return 'Não foi possível concluir o cadastro. Esse nome de usuário pode já estar em uso';
    }
    if (/password/i.test(mensagem)) {
      return 'A senha não foi aceita. Use ao menos 6 caracteres';
    }
    return `Não foi possível concluir o cadastro: ${mensagem}`;
  }

  buscarEmpresasParaCadastro(termo: string): Promise<ResultadoRemoto<EmpresaParaCadastro[]>> {
    return protegido(async () => {
      const { data, error, status } = await this.cliente.rpc('buscar_empresas_cadastro', {
        p_termo: termo,
      });

      if (error) return falhaDe(error, status);

      const linhas = (data ?? []) as { id: string; nome: string }[];
      return remotoOk(linhas.map((linha) => ({ id: linha.id, nome: linha.nome })));
    });
  }

  obterMeuPerfil(): Promise<ResultadoRemoto<Usuario | null>> {
    return protegido(async () => {
      const sessao = await this.cliente.auth.getSession();
      const usuarioId = sessao.data.session?.user.id;
      if (!usuarioId) return remotoFalhou('nao_autenticado', 'Sem sessão na nuvem');

      const { data, error, status } = await this.cliente
        .from('perfis')
        .select('*, usuario_enderecos(endereco_id)')
        .eq('id', usuarioId)
        .maybeSingle();

      if (error) return falhaDe(error, status);
      return remotoOk(data ? usuarioDeRemoto(data as PerfilRemoto) : null);
    });
  }

  /**
   * A senha atual é conferida com um novo login — o Supabase não tem uma
   * chamada só de "verificar senha" — e só então a nova é gravada.
   */
  alterarSenha(senhaAtual: string, novaSenha: string): Promise<ResultadoRemoto> {
    return protegido(async () => {
      const sessao = await this.cliente.auth.getSession();
      const email = sessao.data.session?.user.email;
      if (!email) return remotoFalhou('nao_autenticado', 'Sem sessão na nuvem');

      const conferencia = await this.cliente.auth.signInWithPassword({
        email,
        password: senhaAtual,
      });
      if (conferencia.error) {
        return ehErroDeRede(conferencia.error)
          ? remotoFalhou('rede', SEM_REDE)
          : remotoFalhou('rejeitado', 'A senha atual está incorreta');
      }

      const troca = await this.cliente.auth.updateUser({ password: novaSenha });
      if (troca.error) {
        return ehErroDeRede(troca.error)
          ? remotoFalhou('rede', SEM_REDE)
          : remotoFalhou('rejeitado', troca.error.message);
      }

      return remotoOk();
    });
  }

  /**
   * `getSession` devolve a sessão guardada e, se o token de acesso estiver
   * vencido, tenta renová-lo com o token de renovação. Sem rede a renovação
   * falha como erro "repetível" e a sessão guardada NÃO é apagada — é isso que
   * mantém quem está offline dentro do app.
   */
  garantirSessao(): Promise<ResultadoRemoto<IdentidadeRemota | null>> {
    return protegido(async () => {
      const { data, error } = await this.cliente.auth.getSession();

      if (error) {
        return ehErroDeRede(error)
          ? remotoFalhou('rede', SEM_REDE)
          : remotoFalhou('nao_autenticado', 'A sessão na nuvem expirou');
      }
      if (!data.session) return remotoOk(null);

      return remotoOk({
        usuarioId: data.session.user.id,
        email: data.session.user.email ?? '',
      });
    });
  }

  /**
   * Tenta revogar a sessão no servidor; sem rede isso falha e o cliente
   * manteria os tokens, então o encerramento local é feito em seguida de
   * qualquer forma. Depois de sair, nenhum token fica no aparelho.
   */
  async sair(): Promise<void> {
    try {
      const { error } = await this.cliente.auth.signOut();
      if (error) await this.cliente.auth.signOut({ scope: 'local' });
    } catch {
      try {
        await this.cliente.auth.signOut({ scope: 'local' });
      } catch {
        // Sem ter como falar nem com o cofre, não há mais o que fazer aqui.
      }
    }
  }
}
