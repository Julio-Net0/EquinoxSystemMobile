import React, { useState } from 'react';
import { ObterFotoDaLeituraOutput } from '@/application/use-cases/ObterFotoDaLeituraUseCase';
import { useVoltar } from '@/presentation/hooks/useVoltar';
import { LeiturasUsinaScreen } from '@/presentation/screens/LeiturasUsinaScreen';
import { useLeiturasUsina } from '@/presentation/hooks/useLeiturasUsina';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { VisualizadorComprovante } from '@/presentation/components/VisualizadorComprovante';

export default function LeiturasUsinaRoute() {
  const voltar = useVoltar('/(app)/(tabs)/home');
  const estado = useLeiturasUsina();
  const casos = useCasos();

  const [fotoAberta, setFotoAberta] = useState(false);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [foto, setFoto] = useState<ObterFotoDaLeituraOutput | null>(null);

  // O arquivo local vem primeiro; sem ele, a foto vem da nuvem por URL
  // assinada de vida curta (o bucket é privado).
  const verFoto = async (leituraId: string) => {
    setFoto(null);
    setFotoAberta(true);
    setCarregandoFoto(true);
    try {
      setFoto(await casos.fotoDaLeitura.executar({ leituraId }));
    } finally {
      setCarregandoFoto(false);
    }
  };

  return (
    <>
      <LeiturasUsinaScreen
        usinas={estado.usinas}
        usinaSelecionada={estado.usinaSelecionada}
        dataLocal={estado.dataLocal}
        dataLocalFormatada={estado.dataLocalFormatada}
        diasComLeitura={estado.diasComLeitura}
        resumo={estado.resumo}
        medidores={estado.medidores}
        carregando={estado.carregando}
        erro={estado.erro}
        onSelecionarUsina={estado.selecionarUsina}
        onDesmarcarUsina={estado.desmarcarUsina}
        onMudarData={estado.mudarData}
        onDiaAnterior={estado.diaAnterior}
        onDiaSeguinte={estado.diaSeguinte}
        onRecarregar={estado.recarregar}
        onVoltar={voltar}
        onVerFoto={(leituraId) => void verFoto(leituraId)}
      />
      <VisualizadorComprovante
        visivel={fotoAberta}
        carregando={carregandoFoto}
        foto={foto}
        onFechar={() => setFotoAberta(false)}
      />
    </>
  );
}
