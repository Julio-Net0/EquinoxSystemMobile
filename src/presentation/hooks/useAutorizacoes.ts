import { useCallback, useEffect, useMemo, useState } from 'react';
import { UsuarioResumoDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { EnderecoEstruturaDTO } from '@/application/use-cases/GerenciarEstruturaUseCase';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { ItemSelecionavel } from '@/presentation/components/SeletorBusca';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export interface EstadoAutorizacoes {
  pendentes: UsuarioResumoDTO[];
  enderecos: ItemSelecionavel[];
  carregando: boolean;
  erro: string | null;
  processandoId: string | null;
  recarregar(): Promise<void>;
  autorizar(usuarioId: string, perfil: PerfilEnum, enderecoIds: string[]): Promise<string | null>;
  recusar(usuarioId: string): Promise<string | null>;
}

/** Controlador da tela "Aprovar cadastros". */
export function useAutorizacoes(): EstadoAutorizacoes {
  const { usuario } = useAuth();
  const casos = useCasos();

  const [pendentes, setPendentes] = useState<UsuarioResumoDTO[]>([]);
  const [enderecosBrutos, setEnderecosBrutos] = useState<EnderecoEstruturaDTO[]>([]);
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
        status: StatusUsuarioEnum.PENDENTE,
      });

      if (lista.erro) {
        setErro(lista.erro);
        return;
      }
      setPendentes(lista.usuarios);

      // Endereços oferecidos para vincular: o caso de uso já limita ao escopo
      // do administrador.
      const estrutura = await casos.gerenciarEstrutura.listarEnderecos({
        atorId: usuario.usuarioId,
      });
      setEnderecosBrutos(estrutura.enderecos);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [usuario, casos.gerenciarUsuarios, casos.gerenciarEstrutura]);

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

  const decidir = useCallback(
    async (
      usuarioId: string,
      acao: 'autorizar' | 'recusar',
      perfil?: PerfilEnum,
      enderecoIds?: string[],
    ): Promise<string | null> => {
      if (!usuario) return 'Sessão inválida. Entre de novo';

      setProcessandoId(usuarioId);
      try {
        const saida = await casos.autorizar.executar({
          atorId: usuario.usuarioId,
          usuarioId,
          acao,
          perfil,
          enderecoIds,
        });

        if (!saida.sucesso) return saida.erro ?? 'Não foi possível concluir.';

        // Sai da lista de pendentes: a decisão muda o status.
        setPendentes((atuais) => atuais.filter((u) => u.usuarioId !== usuarioId));
        return null;
      } finally {
        setProcessandoId(null);
      }
    },
    [usuario, casos.autorizar],
  );

  return {
    pendentes,
    enderecos,
    carregando,
    erro,
    processandoId,
    recarregar,
    autorizar: (usuarioId, perfil, enderecoIds) =>
      decidir(usuarioId, 'autorizar', perfil, enderecoIds),
    recusar: (usuarioId) => decidir(usuarioId, 'recusar'),
  };
}
