import React from 'react';
import { useRouter } from 'expo-router';
import { DashboardScreen } from '@/presentation/screens/DashboardScreen';

export default function DashboardRoute() {
  const router = useRouter();

  return (
    <DashboardScreen
      onNavegarNovaLeitura={() => router.push('/leitura/nova' as any)}
      onNavegarUsinas={() => router.push('/(tabs)/usinas' as any)}
      onNavegarNovaUsina={() => router.push('/usina/nova' as any)}
    />
  );
}
