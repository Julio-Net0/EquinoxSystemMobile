import React from 'react';
import { useVoltar } from '@/presentation/hooks/useVoltar';
import { LeiturasUsinaScreen } from '@/presentation/screens/LeiturasUsinaScreen';
import { useLeiturasUsina } from '@/presentation/hooks/useLeiturasUsina';

export default function LeiturasUsinaRoute() {
  const voltar = useVoltar('/(app)/(tabs)/home');
  const estado = useLeiturasUsina();

  return (
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
    />
  );
}

