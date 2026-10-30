import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { Cores } from '@/constants/theme';
import { nivelDe } from '@/domain/enums/PerfilEnum';
import { useAuth } from '@/presentation/hooks/useAuth';

/**
 * Guarda de papel da área administrativa: nível 1 (Técnico) não entra.
 *
 * O escopo de dados -- administrador só alcança a própria empresa -- não é
 * resolvido aqui: isso é regra de negócio e vive nos casos de uso, que recebem
 * o ator da sessão. Esta guarda só evita abrir a tela.
 */
export default function AdminLayout() {
  const { perfil, isCarregando } = useAuth();

  if (isCarregando) return null;
  if (!perfil || nivelDe(perfil) < 2) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Cores.surface },
      }}
    />
  );
}
