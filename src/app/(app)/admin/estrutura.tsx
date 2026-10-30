import React from 'react';
import { useRouter } from 'expo-router';
import { useVoltar } from '@/presentation/hooks/useVoltar';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { GestaoEstruturaScreen } from '@/presentation/screens/GestaoEstruturaScreen';
import { useEstrutura } from '@/presentation/hooks/useEstrutura';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function EstruturaRoute() {
  const router = useRouter();
  const voltar = useVoltar('/(app)/(tabs)/home');
  const { perfil } = useAuth();
  const estado = useEstrutura();

  return (
    <GestaoEstruturaScreen
      ehSuperAdmin={perfil === PerfilEnum.SUPER_ADMIN}
      empresas={estado.empresas}
      empresaAberta={estado.empresaAberta}
      enderecos={estado.enderecos}
      padroesPorEndereco={estado.padroesPorEndereco}
      carregando={estado.carregando}
      erro={estado.erro}
      processando={estado.processando}
      onAbrirEmpresa={estado.abrirEmpresa}
      onCarregarPadroes={(id) => void estado.carregarPadroes(id)}
      onCriarEmpresa={estado.criarEmpresa}
      onCriarEndereco={estado.criarEndereco}
      onAtualizarEndereco={estado.atualizarEndereco}
      onExcluirEndereco={estado.excluirEndereco}
      onCriarPadrao={estado.criarPadrao}
      onExcluirPadrao={estado.excluirPadrao}
      onVoltar={voltar}
    />
  );
}
