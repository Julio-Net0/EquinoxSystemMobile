import React from 'react';
import { useRouter } from 'expo-router';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { HomeScreen } from '@/presentation/screens/HomeScreen';
import { useAuth } from '@/presentation/hooks/useAuth';
import { useHome } from '@/presentation/hooks/useHome';

export default function HomeRoute() {
  const router = useRouter();
  const { usuario, perfil } = useAuth();
  const { enderecos, avisosNaoLidos, carregando, erro, recarregar } = useHome();

  return (
    <HomeScreen
      nome={usuario?.nome ?? ''}
      perfil={perfil ?? PerfilEnum.TECNICO}
      enderecos={enderecos}
      avisosNaoLidos={avisosNaoLidos}
      carregando={carregando}
      erro={erro}
      onRecarregar={() => void recarregar()}
      onNovaLeitura={() => router.push('/(app)/(tabs)/leituras')}
      onAvisos={() => router.push('/(app)/(tabs)/notificacoes')}
      onAutorizacoes={() => router.push('/(app)/admin/autorizacoes')}
      onUsuarios={() => router.push('/(app)/admin/usuarios')}
      onEstrutura={() => router.push('/(app)/admin/estrutura')}
    />
  );
}
