import { useCallback, useEffect, useState } from 'react';
import { NotificacaoDTO } from '@/application/use-cases/GerenciarNotificacoesUseCase';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export interface EstadoNotificacoes {
  notificacoes: NotificacaoDTO[];
  temMais: boolean;
  carregando: boolean;
  erro: string | null;
  decidindoId: string | null;
  carregarMais(): Promise<void>;
  marcarLida(id: string): Promise<void>;
  marcarTodasLidas(): Promise<void>;
  decidir(id: string, decisao: 'aprovar' | 'descartar'): Promise<void>;
}

/** Controlador da central de notificações, com a paginação de 30 do app antigo. */
export function useNotificacoes(): EstadoNotificacoes {
  const { usuario } = useAuth();
  const casos = useCasos();

  const [notificacoes, setNotificacoes] = useState<NotificacaoDTO[]>([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [decidindoId, setDecidindoId] = useState<string | null>(null);

  const buscar = useCallback(
    async (paginaAlvo: number, acumular: boolean) => {
      if (!usuario) return;

      setCarregando(true);
      setErro(null);

      try {
        const saida = await casos.notificacoes.listar({
          atorId: usuario.usuarioId,
          pagina: paginaAlvo,
        });

        if (saida.erro) {
          setErro(saida.erro);
          return;
        }

        setNotificacoes((atuais) =>
          acumular ? [...atuais, ...saida.notificacoes] : saida.notificacoes,
        );
        setTemMais(saida.temMais);
        setPagina(paginaAlvo);
      } catch (falha) {
        setErro((falha as Error).message);
      } finally {
        setCarregando(false);
      }
    },
    [usuario, casos.notificacoes],
  );

  useEffect(() => {
    void buscar(1, false);
  }, [buscar]);

  const carregarMais = useCallback(async () => {
    if (!temMais || carregando) return;
    await buscar(pagina + 1, true);
  }, [temMais, carregando, pagina, buscar]);

  const marcarLida = useCallback(
    async (id: string) => {
      if (!usuario) return;

      // Marca na tela primeiro: a lista não deve piscar por causa de uma
      // gravação local que praticamente não falha.
      setNotificacoes((atuais) =>
        atuais.map((n) => (n.notificacaoId === id ? { ...n, lida: true } : n)),
      );

      await casos.notificacoes.marcarLida({ atorId: usuario.usuarioId, notificacaoId: id });
    },
    [usuario, casos.notificacoes],
  );

  const marcarTodasLidas = useCallback(async () => {
    if (!usuario) return;
    await casos.notificacoes.marcarTodasLidas({ atorId: usuario.usuarioId });
    await buscar(1, false);
  }, [usuario, casos.notificacoes, buscar]);

  const decidir = useCallback(
    async (id: string, decisao: 'aprovar' | 'descartar') => {
      if (!usuario) return;

      setDecidindoId(id);
      setErro(null);

      try {
        const saida = await casos.decidirLeitura.executar({
          atorId: usuario.usuarioId,
          notificacaoId: id,
          decisao,
        });

        if (!saida.sucesso) {
          setErro(saida.erro ?? 'Não foi possível registrar a decisão.');
          return;
        }

        // Relê a primeira página: a decisão muda o card e pode ter gerado
        // outros avisos.
        await buscar(1, false);
      } finally {
        setDecidindoId(null);
      }
    },
    [usuario, casos.decidirLeitura, buscar],
  );

  return {
    notificacoes,
    temMais,
    carregando,
    erro,
    decidindoId,
    carregarMais,
    marcarLida,
    marcarTodasLidas,
    decidir,
  };
}
