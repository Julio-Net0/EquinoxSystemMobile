import React, { useCallback, useEffect, useState } from 'react';
import { ConsultarDiagnosticoOutput } from '@/application/use-cases/ConsultarDiagnosticoUseCase';
import { DiagnosticoScreen } from '@/presentation/screens/DiagnosticoScreen';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from '@/presentation/hooks/useAuth';
import { useVoltar } from '@/presentation/hooks/useVoltar';

export default function DiagnosticoRoute() {
  const { usuario } = useAuth();
  const casos = useCasos();
  const voltar = useVoltar('/(app)/(tabs)/perfil');

  const [dados, setDados] = useState<ConsultarDiagnosticoOutput | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setCarregando(true);
    setErro(null);
    try {
      setDados(await casos.diagnostico.executar({ usuarioId: usuario.usuarioId }));
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [usuario, casos.diagnostico]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <DiagnosticoScreen
      dados={dados}
      carregando={carregando}
      erro={erro}
      onRecarregar={() => void carregar()}
      onVoltar={voltar}
    />
  );
}
