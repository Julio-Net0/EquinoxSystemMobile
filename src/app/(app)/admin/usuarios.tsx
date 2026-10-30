import React from 'react';
import { useRouter } from 'expo-router';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { GestaoUsuariosScreen } from '@/presentation/screens/GestaoUsuariosScreen';
import { useGestaoUsuarios } from '@/presentation/hooks/useGestaoUsuarios';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function UsuariosRoute() {
  const router = useRouter();
  const { perfil } = useAuth();
  const estado = useGestaoUsuarios();

  return (
    <GestaoUsuariosScreen
      usuarios={estado.usuarios}
      enderecos={estado.enderecos}
      filtro={estado.filtro}
      busca={estado.busca}
      carregando={estado.carregando}
      erro={estado.erro}
      processandoId={estado.processandoId}
      podeConcederSuperAdmin={perfil === PerfilEnum.SUPER_ADMIN}
      onFiltro={estado.setFiltro}
      onBusca={estado.setBusca}
      onSalvar={estado.salvar}
      onAlternarStatus={estado.alternarStatus}
      onAprovarRapido={estado.aprovarRapido}
      onExcluir={estado.excluir}
      onVoltar={() => router.back()}
    />
  );
}
