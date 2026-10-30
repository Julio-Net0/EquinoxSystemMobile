import React from 'react';
import { useRouter } from 'expo-router';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { AutorizacoesScreen } from '@/presentation/screens/AutorizacoesScreen';
import { useAutorizacoes } from '@/presentation/hooks/useAutorizacoes';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function AutorizacoesRoute() {
  const router = useRouter();
  const { perfil } = useAuth();
  const estado = useAutorizacoes();

  return (
    <AutorizacoesScreen
      pendentes={estado.pendentes}
      enderecos={estado.enderecos}
      carregando={estado.carregando}
      erro={estado.erro}
      processandoId={estado.processandoId}
      podeConcederSuperAdmin={perfil === PerfilEnum.SUPER_ADMIN}
      onAutorizar={estado.autorizar}
      onRecusar={estado.recusar}
      onVoltar={() => router.back()}
    />
  );
}
