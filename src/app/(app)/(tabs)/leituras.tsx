import React from 'react';
import { useRouter } from 'expo-router';
import { CatalogoLeiturasScreen } from '@/presentation/screens/CatalogoLeiturasScreen';
import { useHome } from '@/presentation/hooks/useHome';

export default function LeiturasRoute() {
  const router = useRouter();
  const { enderecos, carregando, erro, recarregar } = useHome();

  return (
    <CatalogoLeiturasScreen
      enderecos={enderecos}
      carregando={carregando}
      erro={erro}
      onRecarregar={() => void recarregar()}
      onAbrirPadrao={(padraoId) =>
        router.push({ pathname: '/(app)/leitura/[padraoId]', params: { padraoId } })
      }
    />
  );
}
