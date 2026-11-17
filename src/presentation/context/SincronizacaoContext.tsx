import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SincronizarOutput } from '@/application/use-cases/SincronizarUseCase';
import { EstadoSincronizacaoOutput } from '@/application/use-cases/ConsultarEstadoSincronizacaoUseCase';
import { nivelDe } from '@/domain/enums/PerfilEnum';
import { useContainer } from './ContainerProvider';
import { useConectividade } from './ConectividadeContext';
import { useAuth } from '../hooks/useAuth';

export interface SincronizacaoContextData {
  sincronizando: boolean;
  /** Itens que ainda não subiram, isolados incluídos. */
  pendentes: number;
  /** Itens fora da fila automática, à espera de "Tentar de novo". */
  isolados: number;
  ultimaSincronizacaoEm: string | null;
  /** Frase pronta para a tela, do último problema — ou nulo se está tudo bem. */
  aviso: string | null;
  estado: EstadoSincronizacaoOutput | null;
  /**
   * Sobe a cada sincronização que trouxe dados da nuvem. As telas que mostram
   * dados do banco local dependem dela para recarregar.
   */
  versaoDosDados: number;
  /** Botão manual. Nunca lança. */
  sincronizar(): Promise<SincronizarOutput | null>;
  /** Devolve à fila os itens isolados e sincroniza. */
  tentarDeNovo(): Promise<void>;
}

const SincronizacaoContext = createContext<SincronizacaoContextData | null>(null);

/** Espera depois da última escrita local antes de tentar enviar. */
const ATRASO_APOS_ESCRITA_MS = 1500;

/**
 * Dispara e acompanha a sincronização.
 *
 * Os três gatilhos da metodologia estão aqui:
 *
 * 1. **Ao abrir o app autenticado** — o efeito sobre `isAutenticado`.
 * 2. **Ao recuperar a conexão** — o efeito sobre a transição offline → online.
 * 3. **Pelo botão manual** — `sincronizar()`.
 *
 * Há um quarto, de conveniência: pouco depois de qualquer escrita local, para
 * que com rede o dado suba logo, sem esperar o técnico pedir.
 *
 * As telas não chamam a nuvem: leem o SQLite. Este provedor só avisa, por
 * `versaoDosDados`, que o SQLite mudou.
 */
export function SincronizacaoProvider({ children }: { children: ReactNode }) {
  const { casos, observarFila } = useContainer();
  const { isAutenticado, perfil, recarregar } = useAuth();
  const { online } = useConectividade();

  const [sincronizando, setSincronizando] = useState(false);
  const [estado, setEstado] = useState<EstadoSincronizacaoOutput | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [versaoDosDados, setVersaoDosDados] = useState(0);

  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const atualizarEstado = useCallback(async () => {
    const lido = await casos.estadoSincronizacao.executar();
    if (montado.current) setEstado(lido);
  }, [casos.estadoSincronizacao]);

  const sincronizar = useCallback(async (): Promise<SincronizarOutput | null> => {
    if (!isAutenticado) return null;

    setSincronizando(true);
    try {
      const saida = await casos.sincronizar.executar();
      if (!montado.current || saida.situacao === 'ocupado') return saida;

      setAviso(saida.mensagem ?? null);
      if (saida.recebidos > 0) setVersaoDosDados((v) => v + 1);

      // A sincronização pode ter mudado a sessão: nome e nível novos, ou o
      // acesso revogado (a sessão some e as guardas de rota levam ao login).
      await recarregar();
      await atualizarEstado();
      return saida;
    } finally {
      if (montado.current) setSincronizando(false);
    }
  }, [isAutenticado, casos.sincronizar, recarregar, atualizarEstado]);

  // Mantém a versão mais recente à mão sem recriar os efeitos de gatilho.
  const sincronizarAtual = useRef(sincronizar);
  useEffect(() => {
    sincronizarAtual.current = sincronizar;
  }, [sincronizar]);

  // Gatilho 1: abriu o app autenticado. As rotinas de manutenção vêm depois da
  // primeira sincronização, para avaliarem o banco já atualizado.
  const nivel = perfil ? nivelDe(perfil) : 0;
  useEffect(() => {
    if (!isAutenticado) {
      setEstado(null);
      setAviso(null);
      return;
    }

    (async () => {
      await sincronizarAtual.current();
      try {
        // Só administrador avalia atrasos: é quem enxerga os avisos de toda a
        // empresa, então não gera de novo um que outro aparelho já gerou.
        if (nivel >= 2) await casos.avaliarAtrasadas.executar();
        await casos.purgar.executar();
      } catch (erro) {
        // Rotina de manutenção não deve impedir o uso do app.
        console.warn('[equinox] rotinas de abertura falharam', erro);
      }
    })();
  }, [isAutenticado, nivel, casos.avaliarAtrasadas, casos.purgar]);

  // Gatilho 2: a conexão voltou.
  const onlineAntes = useRef(online);
  useEffect(() => {
    const voltou = online && !onlineAntes.current;
    onlineAntes.current = online;
    if (voltou) void sincronizarAtual.current();
  }, [online]);

  // Conveniência: houve escrita local. Atualiza a contagem na hora e tenta
  // enviar logo em seguida, juntando escritas próximas numa rodada só.
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const cancelar = observarFila(() => {
      void atualizarEstado();
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => void sincronizarAtual.current(), ATRASO_APOS_ESCRITA_MS);
    });

    return () => {
      if (temporizador) clearTimeout(temporizador);
      cancelar();
    };
  }, [observarFila, atualizarEstado]);

  const tentarDeNovo = useCallback(async () => {
    await casos.estadoSincronizacao.tentarDeNovo();
    await sincronizarAtual.current();
  }, [casos.estadoSincronizacao]);

  const valor = useMemo<SincronizacaoContextData>(
    () => ({
      sincronizando,
      pendentes: estado?.pendentes ?? 0,
      isolados: estado?.isolados ?? 0,
      ultimaSincronizacaoEm: estado?.ultimaSincronizacaoEm ?? null,
      aviso,
      estado,
      versaoDosDados,
      sincronizar,
      tentarDeNovo,
    }),
    [sincronizando, estado, aviso, versaoDosDados, sincronizar, tentarDeNovo],
  );

  return <SincronizacaoContext.Provider value={valor}>{children}</SincronizacaoContext.Provider>;
}

export function useSincronizacao(): SincronizacaoContextData {
  const contexto = useContext(SincronizacaoContext);

  if (!contexto) {
    throw new Error('useSincronizacao precisa estar dentro de um SincronizacaoProvider');
  }

  return contexto;
}
