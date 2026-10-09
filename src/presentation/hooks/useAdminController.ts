import { useState } from 'react';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { AutorizarUsuarioUseCase, AutorizarUsuarioInputDTO } from '@/application/use-cases/AutorizarUsuarioUseCase';
import { GerenciarUsuariosEmpresaUseCase, ListarUsuariosInputDTO, UsuarioOutputDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { GerenciarEmpresasUseCase, CriarEmpresaInputDTO, EmpresaOutputDTO } from '@/application/use-cases/GerenciarEmpresasUseCase';

export interface UseAdminControllerReturn {
  loading: boolean;
  erro: string | null;
  autorizarUsuario: (input: AutorizarUsuarioInputDTO) => Promise<boolean>;
  listarUsuarios: (input: ListarUsuariosInputDTO) => Promise<UsuarioOutputDTO[]>;
  alternarStatusUsuario: (usuarioId: string) => Promise<UsuarioOutputDTO | null>;
  excluirUsuario: (usuarioId: string) => Promise<boolean>;
  criarEmpresa: (input: CriarEmpresaInputDTO) => Promise<EmpresaOutputDTO | null>;
  listarEmpresas: () => Promise<EmpresaOutputDTO[]>;
}

export function useAdminController(
  usuarioRepo: IUsuarioRepository,
  empresaRepo: IEmpresaRepository
): UseAdminControllerReturn {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const autorizarUseCase = new AutorizarUsuarioUseCase(usuarioRepo);
  const gerenciarUsuariosUseCase = new GerenciarUsuariosEmpresaUseCase(usuarioRepo);
  const gerenciarEmpresasUseCase = new GerenciarEmpresasUseCase(empresaRepo);

  const autorizarUsuario = async (input: AutorizarUsuarioInputDTO): Promise<boolean> => {
    setLoading(true);
    setErro(null);
    try {
      await autorizarUseCase.execute(input);
      return true;
    } catch (err: any) {
      setErro(err.message || 'Erro ao autorizar usuário');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const listarUsuarios = async (input: ListarUsuariosInputDTO): Promise<UsuarioOutputDTO[]> => {
    setLoading(true);
    setErro(null);
    try {
      return await gerenciarUsuariosUseCase.listar(input);
    } catch (err: any) {
      setErro(err.message || 'Erro ao listar usuários');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const alternarStatusUsuario = async (usuarioId: string): Promise<UsuarioOutputDTO | null> => {
    setLoading(true);
    setErro(null);
    try {
      return await gerenciarUsuariosUseCase.alternarStatus({ usuarioId });
    } catch (err: any) {
      setErro(err.message || 'Erro ao alterar status');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const excluirUsuario = async (usuarioId: string): Promise<boolean> => {
    setLoading(true);
    setErro(null);
    try {
      await gerenciarUsuariosUseCase.excluir({ usuarioId });
      return true;
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir usuário');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const criarEmpresa = async (input: CriarEmpresaInputDTO): Promise<EmpresaOutputDTO | null> => {
    setLoading(true);
    setErro(null);
    try {
      return await gerenciarEmpresasUseCase.criar(input);
    } catch (err: any) {
      setErro(err.message || 'Erro ao cadastrar empresa');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const listarEmpresas = async (): Promise<EmpresaOutputDTO[]> => {
    setLoading(true);
    setErro(null);
    try {
      return await gerenciarEmpresasUseCase.listar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao listar empresas');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    erro,
    autorizarUsuario,
    listarUsuarios,
    alternarStatusUsuario,
    excluirUsuario,
    criarEmpresa,
    listarEmpresas,
  };
}
