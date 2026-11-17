import React, { ReactNode, createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';
import { PerfilEnum, NivelAcesso, nivelDe } from '@/domain/enums/PerfilEnum';
import { useContainer } from './ContainerProvider';

export interface AuthContextData {
  usuario: SessaoUsuarioData | null;
  perfil: PerfilEnum | null;
  nivel: NivelAcesso | null;
  empresaId: string | null;
  isAutenticado: boolean;
  /** Verdadeiro só até a sessão guardada ser lida, no primeiro render. */
  isCarregando: boolean;
  /**
   * Login na nuvem, por e-mail. Exige rede. Em caso de sucesso já volta com os
   * dados do usuário baixados para o banco local.
   */
  entrar(email: string, senha: string): Promise<{ sucesso: boolean; erro?: string }>;
  /** Apaga a sessão local e os tokens. O próximo acesso exige rede. */
  sair(): Promise<void>;
  /** Relê a sessão do armazenamento — usar após alterar os próprios dados. */
  recarregar(): Promise<void>;
}

const AuthContext = createContext<AuthContextData | null>(null);

/**
 * Sessão do usuário para toda a interface.
 *
 * **Login offline.** Na abertura, este provedor só lê a sessão do
 * armazenamento seguro — não fala com a rede. Quem já entrou uma vez reabre o
 * app autenticado mesmo em modo avião e mesmo com o token de acesso vencido.
 * A renovação do token acontece depois, em segundo plano, quando há conexão
 * (ver `SincronizacaoContext`); se ela não for possível, o técnico continua
 * trabalhando e só a sincronização fica à espera.
 *
 * Os tokens da nuvem não passam por aqui: ficam no armazenamento seguro, por
 * conta do adaptador de autenticação.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { casos, gateways } = useContainer();
  const [usuario, setUsuario] = useState<SessaoUsuarioData | null>(null);
  const [isCarregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setUsuario(await gateways.sessao.obterSessao());
  }, [gateways.sessao]);

  useEffect(() => {
    let ativo = true;

    (async () => {
      const sessao = await gateways.sessao.obterSessao();
      // A tela pode ter desmontado durante a leitura do armazenamento seguro.
      if (!ativo) return;
      setUsuario(sessao);
      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, [gateways.sessao]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const saida = await casos.autenticar.executar({ login: email, senha });

      if (!saida.sucesso || !saida.usuario) {
        return { sucesso: false, erro: saida.erro };
      }

      // Primeira sincronização antes de liberar a interface: é ela que traz a
      // empresa, os endereços e os padrões para o SQLite. Sem isso o técnico
      // entraria num app vazio e, se saísse para o campo, ficaria sem nada.
      // Se falhar, ele entra mesmo assim e o app tenta de novo sozinho.
      await casos.sincronizar.executar();

      setUsuario((await gateways.sessao.obterSessao()) ?? saida.usuario);
      return { sucesso: true };
    },
    [casos.autenticar, casos.sincronizar, gateways.sessao],
  );

  const sair = useCallback(async () => {
    await casos.encerrarSessao.executar();
    setUsuario(null);
  }, [casos.encerrarSessao]);

  const valor = useMemo<AuthContextData>(
    () => ({
      usuario,
      perfil: usuario?.perfil ?? null,
      nivel: usuario ? nivelDe(usuario.perfil) : null,
      empresaId: usuario?.empresaId ?? null,
      isAutenticado: usuario !== null,
      isCarregando,
      entrar,
      sair,
      recarregar,
    }),
    [usuario, isCarregando, entrar, sair, recarregar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export { AuthContext };
