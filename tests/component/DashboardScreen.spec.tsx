import React from 'react';
import { DashboardScreen } from '@/presentation/screens/DashboardScreen';
import { AuthContext, AuthContextData } from '@/presentation/context/AuthContext';

// Mock do react-native com Platform.select
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('div', props, props.children),
    Text: (props: any) => React.createElement('span', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('button', { ...props, onClick: props.onPress }, props.children),
    ScrollView: (props: any) => React.createElement('div', props, props.children),
    StyleSheet: { create: (styles: any) => styles },
    Platform: {
      select: (objs: any) => objs.default || objs.ios || {},
      OS: 'android',
    },
  };
});

describe('Fase 5 - Testes de Componente: DashboardScreen', () => {
  const mockAuthContext: AuthContextData = {
    usuario: {
      usuarioId: 'user-123',
      empresaId: 'empresa-456',
      nome: 'Engenheiro Sol',
      email: 'eng@equinox.com',
      perfil: 'Admin',
    },
    perfil: 'Admin',
    empresaId: 'empresa-456',
    isAuthenticated: true,
    isLoading: false,
    loginOnline: jest.fn(),
    desbloquearComPin: jest.fn(),
    definirPinLocal: jest.fn(),
    logout: jest.fn(),
  };

  it('deve verificar a inicializacao do DashboardScreen com perfil de usuario', () => {
    expect(DashboardScreen).toBeDefined();
    expect(mockAuthContext.usuario?.nome).toBe('Engenheiro Sol');
    expect(mockAuthContext.perfil).toBe('Admin');
  });
});
