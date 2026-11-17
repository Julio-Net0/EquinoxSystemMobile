import { useCallback, useEffect, useState } from 'react';
import {
  MedidorDiaDTO,
  ResumoLeiturasDiaDTO,
  UsinaItemDTO,
} from '@/application/use-cases/ConsultarLeiturasDiaUsinaUseCase';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export interface EstadoLeiturasUsina {
  carregando: boolean;
  erro: string | null;
  usinas: UsinaItemDTO[];
  usinaSelecionada: UsinaItemDTO | null;
  dataLocal: string;
  dataLocalFormatada: string;
  diasComLeitura: string[];
  resumo: ResumoLeiturasDiaDTO;
  medidores: MedidorDiaDTO[];
  selecionarUsina(usinaId: string): Promise<void>;
  desmarcarUsina(): void;
  mudarData(novaDataLocal: string): Promise<void>;
  diaAnterior(): Promise<void>;
  diaSeguinte(): Promise<void>;
  recarregar(): Promise<void>;
}

function somarDias(dataIso: string, deltaDias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + deltaDias);
  const a = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const diaStr = String(d.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${diaStr}`;
}

const RESUMO_VAZIO: ResumoLeiturasDiaDTO = {
  totalMedidores: 0,
  medidoresComLeitura: 0,
  medidoresSemLeitura: 0,
  totalSubstituicoes: 0,
  totalAlertas: 0,
};

export function useLeiturasUsina(): EstadoLeiturasUsina {
  const { usuario } = useAuth();
  const casos = useCasos();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [usinas, setUsinas] = useState<UsinaItemDTO[]>([]);
  const [usinaSelecionadaId, setUsinaSelecionadaId] = useState<string | null>(null);
  const [dataLocal, setDataLocal] = useState<string>('');
  const [dataLocalFormatada, setDataLocalFormatada] = useState<string>('');
  const [diasComLeitura, setDiasComLeitura] = useState<string[]>([]);
  const [resumo, setResumo] = useState<ResumoLeiturasDiaDTO>(RESUMO_VAZIO);
  const [medidores, setMedidores] = useState<MedidorDiaDTO[]>([]);

  const carregar = useCallback(
    async (alvoUsinaId?: string | null, alvoData?: string) => {
      if (!usuario) return;

      setCarregando(true);
      setErro(null);

      try {
        const resultado = await casos.consultarLeiturasUsina.executar({
          atorId: usuario.usuarioId,
          usinaId: alvoUsinaId ?? undefined,
          dataLocal: alvoData || undefined,
        });

        if (!resultado.sucesso) {
          setErro(resultado.erro ?? 'Erro ao carregar as leituras');
          return;
        }

        setUsinas(resultado.usinas);

        // Se há apenas 1 usina, seleciona ela automaticamente. Se há várias e alvoUsinaId não foi informado, mantém nulo para listar.
        if (alvoUsinaId) {
          setUsinaSelecionadaId(alvoUsinaId);
        } else if (resultado.usinas.length === 1) {
          setUsinaSelecionadaId(resultado.usinas[0].id);
        }

        setDataLocal(resultado.dataLocal);
        setDataLocalFormatada(resultado.dataLocalFormatada);
        setDiasComLeitura(resultado.diasComLeitura);
        setResumo(resultado.resumo);
        setMedidores(resultado.medidores);
      } catch (falha) {
        setErro((falha as Error).message);
      } finally {
        setCarregando(false);
      }
    },
    [usuario, casos.consultarLeiturasUsina],
  );

  const recarregar = useCallback(async () => {
    await carregar(usinaSelecionadaId, dataLocal);
  }, [carregar, usinaSelecionadaId, dataLocal]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const selecionarUsina = useCallback(
    async (usinaId: string) => {
      setUsinaSelecionadaId(usinaId);
      // Ao selecionar a usina, vai automaticamente para a leitura de hoje (sem data fixa passada)
      await carregar(usinaId, '');
    },
    [carregar],
  );

  const desmarcarUsina = useCallback(() => {
    setUsinaSelecionadaId(null);
  }, []);

  const mudarData = useCallback(
    async (novaData: string) => {
      setDataLocal(novaData);
      await carregar(usinaSelecionadaId, novaData);
    },
    [carregar, usinaSelecionadaId],
  );

  const diaAnterior = useCallback(async () => {
    if (!dataLocal) return;
    const anterior = somarDias(dataLocal, -1);
    await mudarData(anterior);
  }, [dataLocal, mudarData]);

  const diaSeguinte = useCallback(async () => {
    if (!dataLocal) return;
    const seguinte = somarDias(dataLocal, 1);
    await mudarData(seguinte);
  }, [dataLocal, mudarData]);

  const usinaSelecionada =
    usinaSelecionadaId !== null
      ? (usinas.find((u) => u.id === usinaSelecionadaId) ?? null)
      : usinas.length === 1
      ? usinas[0]
      : null;

  return {
    carregando,
    erro,
    usinas,
    usinaSelecionada,
    dataLocal,
    dataLocalFormatada,
    diasComLeitura,
    resumo,
    medidores,
    selecionarUsina,
    desmarcarUsina,
    mudarData,
    diaAnterior,
    diaSeguinte,
    recarregar,
  };
}
