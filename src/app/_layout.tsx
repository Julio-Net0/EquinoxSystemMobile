import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/presentation/context/AuthContext';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { SessionStorageMemory } from '@/infrastructure/fakes/SessionStorageMemory';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export default function RootLayout() {
  const usuarioRepo = useMemo(() => {
    const repo = new UsuarioRepositoryMemory();
    // Popula usuário fake inicial para testes/demonstração em tempo real
    repo.salvar(
      new Usuario({
        id: new UUIDv4('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'),
        empresaId: new UUIDv4('550e8400-e29b-41d4-a716-446655440000'),
        nome: 'João da Silva (Técnico)',
        email: 'tecnico@equinox.com',
        perfil: PerfilEnum.TECNICO,
        status: 'Ativo',
      })
    );
    return repo;
  }, []);

  const sessionStorage = useMemo(() => {
    const storage = new SessionStorageMemory();
    storage.salvarPinLocal('123456');
    return storage;
  }, []);

  return (
    <AuthProvider usuarioRepo={usuarioRepo} sessionStorage={sessionStorage}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="leitura/nova" options={{ headerShown: true, title: 'Nova Leitura' }} />
      </Stack>
    </AuthProvider>
  );
}
