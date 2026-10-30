import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NovaLeituraScreen } from '@/presentation/screens/NovaLeituraScreen';
import { CapturaMedidorCamera } from '@/presentation/components/CapturaMedidorCamera';
import { useNovaLeitura } from '@/presentation/hooks/useNovaLeitura';

export default function NovaLeituraRoute() {
  const router = useRouter();
  const { padraoId } = useLocalSearchParams<{ padraoId: string }>();
  const [cameraAberta, setCameraAberta] = useState(false);

  const estado = useNovaLeitura(padraoId ?? '');

  return (
    <>
      <NovaLeituraScreen
        carregando={estado.carregando}
        erro={estado.erro}
        endereco={estado.endereco}
        padrao={estado.padrao}
        consumo={estado.consumo}
        injecao={estado.injecao}
        onConsumo={estado.setConsumo}
        onInjecao={estado.setInjecao}
        fotoUri={estado.fotoUri}
        onAbrirCamera={() => setCameraAberta(true)}
        gps={estado.gps}
        onTentarGps={() => void estado.obterGps()}
        salvando={estado.salvando}
        avisoValorMenor={estado.avisoValorMenor}
        sucesso={estado.sucesso}
        onSalvar={() => void estado.salvar()}
        onConfirmarValorMenor={() => void estado.confirmarValorMenor()}
        onCancelarAviso={estado.cancelarAviso}
        onVoltar={() => router.back()}
        onConcluir={() => router.replace('/(app)/(tabs)/home')}
      />

      <CapturaMedidorCamera
        visivel={cameraAberta}
        onFechar={() => setCameraAberta(false)}
        onCapturada={async () => {
          // Dispara a captura pelo gateway e fecha o preview: só um pode ficar
          // ativo por vez no SDK 57.
          await estado.capturarFoto();
          setCameraAberta(false);
        }}
      />
    </>
  );
}
