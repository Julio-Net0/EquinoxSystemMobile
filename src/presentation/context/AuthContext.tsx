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
  entrar(login: string, senha: string): Promise<{ sucesso: boolean; erro?: string }>;
  sair(): Promise<void>;
  /** Relê a sessão do armazenamento — usar após alterar os próprios dados. */
  recarregar(): Promise<void>;
}

const AuthContext = createContext<AuthContextData | null>(null);

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
    async (login: string, senha: string) => {
      const saida = await casos.autenticar.executar({ login, senha });

      if (saida.sucesso && saida.usuario) {
        setUsuario(saida.usuario);
        return { sucesso: true };
      }

      return { sucesso: false, erro: saida.erro };
    },
    [casos.autenticar],
  );

  const sair = useCallback(async () => {
    await gateways.sessao.limparSessao();
    setUsuario(null);
  }, [gateways.sessao]);

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
