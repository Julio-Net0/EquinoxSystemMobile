import { useCallback, useEffect, useMemo, useState } from 'react';
import { UsuarioResumoDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { EnderecoEstruturaDTO } from '@/application/use-cases/GerenciarEstruturaUseCase';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { ItemSelecionavel } from '@/presentation/components/SeletorBusca';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export type FiltroStatus = 'todos' | StatusUsuarioEnum;

export interface DadosEdicaoUsuario {
  nome: string;
  email: string;
  perfil: PerfilEnum;
  status: StatusUsuarioEnum;
  enderecoIds: string[];
}

export interface EstadoGestaoUsuarios {
  usuarios: UsuarioResumoDTO[];
  enderecos: ItemSelecionavel[];
  filtro: FiltroStatus;
  busca: string;
  carregando: boolean;
  erro: string | null;
  processandoId: string | null;
  setFiltro(filtro: FiltroStatus): void;
  setBusca(termo: string): void;
  recarregar(): Promise<void>;
  salvar(usuarioId: string, dados: DadosEdicaoUsuario): Promise<string | null>;
  alternarStatus(usuarioId: string): Promise<string | null>;
  aprovarRapido(usuarioId: string): Promise<string | null>;
  excluir(usuarioId: string): Promise<string | null>;
}

/** Controlador da tela "Gerenciar usuários". */
export function useGestaoUsuarios(): EstadoGestaoUsuarios {
  const { usuario } = useAuth();
  const casos = useCasos();

  const [usuarios, setUsuarios] = useState<UsuarioResumoDTO[]>([]);
  const [enderecosBrutos, setEnderecosBrutos] = useState<EnderecoEstruturaDTO[]>([]);
  const [filtro, setFiltro] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!usuario) return;

    setCarregando(true);
    setErro(null);

    try {
      const lista = await casos.gerenciarUsuarios.listar({
        atorId: usuario.usuarioId,
        status: filtro === 'todos' ? undefined : filtro,
        termoBusca: busca.trim() || undefined,
      });

      if (lista.erro) {
        setErro(lista.erro);
        return;
      }
      setUsuarios(lista.usuarios);

      const estrutura = await casos.gerenciarEstrutura.listarEnderecos({
        atorId: usuario.usuarioId,
      });
      setEnderecosBrutos(estrutura.enderecos);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [usuario, filtro, busca, casos.gerenciarUsuarios, casos.gerenciarEstrutura]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const enderecos = useMemo<ItemSelecionavel[]>(
    () =>
      enderecosBrutos.map((e) => ({
        id: e.enderecoId,
        rotulo: e.apelido,
        sublinha: `UC ${e.uc}`,
      })),
    [enderecosBrutos],
  );

  /** Envolve uma ação, recarregando a lista no sucesso. */
  const agir = useCallback(
    async (usuarioId: string, acao: () => Promise<{ sucesso: boolean; erro?: string }>) => {
      setProcessandoId(usuarioId);
      try {
        const saida = await acao();
        if (!saida.sucesso) return saida.erro ?? 'Não foi possível concluir.';

        await recarregar();
        return null;
      } finally {
        setProcessandoId(null);
      }
    },
    [recarregar],
  );

  const semSessao = 'Sessão inválida. Entre de novo';

  return {
    usuarios,
    enderecos,
    filtro,
    busca,
    carregando,
    erro,
    processandoId,
    setFiltro,
    setBusca,
    recarregar,

    salvar: (usuarioId, dados) =>
      usuario
        ? agir(usuarioId, () =>
            casos.gerenciarUsuarios.atualizar({
              atorId: usuario.usuarioId,
              usuarioId,
              ...dados,
            }),
          )
        : Promise.resolve(semSessao),

    alternarStatus: (usuarioId) =>
      usuario
        ? agir(usuarioId, () =>
            casos.gerenciarUsuarios.alternarStatus({ atorId: usuario.usuarioId, usuarioId }),
          )
        : Promise.resolve(semSessao),

    aprovarRapido: (usuarioId) =>
      usuario
        ? agir(usuarioId, () =>
            casos.gerenciarUsuarios.aprovarRapido({ atorId: usuario.usuarioId, usuarioId }),
          )
        : Promise.resolve(semSessao),

    excluir: (usuarioId) =>
      usuario
        ? agir(usuarioId, () =>
            casos.gerenciarUsuarios.excluir({ atorId: usuario.usuarioId, usuarioId }),
          )
        : Promise.resolve(semSessao),
  };
}
