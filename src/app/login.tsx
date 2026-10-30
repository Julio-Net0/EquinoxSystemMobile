import React from 'react';
import { Redirect, useRouter } from 'expo-router';
import { LoginScreen } from '@/presentation/screens/LoginScreen';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function LoginRoute() {
  const router = useRouter();
  const { entrar, isAutenticado } = useAuth();

  // Impede voltar ao login pelo botão de voltar depois de autenticado.
  if (isAutenticado) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <LoginScreen
      onEntrar={entrar}
      onIrParaCadastro={() => router.push('/cadastro')}
    />
  );
}
