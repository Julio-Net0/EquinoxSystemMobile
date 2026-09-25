import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SessaoUsuarioData, ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { AutenticarUsuarioUseCase } from '@/application/use-cases/AutenticarUsuarioUseCase';

export interface AuthContextData {
  usuario: SessaoUsuarioData | null;
  perfil: 'SuperAdmin' | 'Admin' | 'Tecnico' | null;
  empresaId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginOnline: (email: string) => Promise<boolean>;
  desbloquearComPin: (pin: string) => Promise<boolean>;
  definirPinLocal: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export interface AuthProviderProps {
  children: ReactNode;
  usuarioRepo: IUsuarioRepository;
  sessionStorage: ISessionStorage;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  usuarioRepo,
  sessionStorage,
}) => {
  const [usuario, setUsuario] = useState<SessaoUsuarioData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function carregarSessao() {
      try {
        const sessaoSalva = await sessionStorage.obterSessao();
        if (sessaoSalva) {
          setUsuario(sessaoSalva);
        }
      } catch (err) {
        console.error('Erro ao carregar sessão inicial:', err);
      } finally {
        setIsLoading(false);
      }
    }
    carregarSessao();
  }, [sessionStorage]);

  const loginOnline = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const useCase = new AutenticarUsuarioUseCase(usuarioRepo, sessionStorage);
      const resultado = await useCase.executar({ email });

      if (resultado.sucesso && resultado.usuario) {
        const sessao: SessaoUsuarioData = {
          usuarioId: resultado.usuario.id.value,
          empresaId: resultado.usuario.empresaId.value,
          nome: resultado.usuario.nome,
          email: resultado.usuario.email,
          perfil: resultado.usuario.perfil,
        };
        setUsuario(sessao);
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const desbloquearComPin = async (pin: string): Promise<boolean> => {
    const ok = await sessionStorage.validarPinLocal(pin);
    if (ok) {
      const sessaoSalva = await sessionStorage.obterSessao();
      if (sessaoSalva) {
        setUsuario(sessaoSalva);
      }
    }
    return ok;
  };

  const definirPinLocal = async (pin: string): Promise<void> => {
    await sessionStorage.salvarPinLocal(pin);
  };

  const logout = async (): Promise<void> => {
    await sessionStorage.limparSessao();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        perfil: usuario?.perfil ?? null,
        empresaId: usuario?.empresaId ?? null,
        isAuthenticated: !!usuario,
        isLoading,
        loginOnline,
        desbloquearComPin,
        definirPinLocal,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
