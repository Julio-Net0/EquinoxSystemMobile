import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LoginScreen } from '@/presentation/screens/LoginScreen';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function LoginRoute() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard' as any);
    }
  }, [isAuthenticated, router]);

  return <LoginScreen />;
}
