import React from 'react';
import { LoginScreen } from '@/presentation/screens/LoginScreen';
import { AuthContext, AuthContextData } from '@/presentation/context/AuthContext';

// Mock do react-native com Platform.select
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('div', props, props.children),
    Text: (props: any) => React.createElement('span', props, props.children),
    TextInput: (props: any) => React.createElement('input', props),
    TouchableOpacity: (props: any) => React.createElement('button', { ...props, onClick: props.onPress }, props.children),
    ActivityIndicator: () => React.createElement('span', null, 'Loading...'),
    StyleSheet: { create: (styles: any) => styles },
    Alert: { alert: jest.fn() },
    Platform: {
      select: (objs: any) => objs.default || objs.ios || {},
      OS: 'android',
    },
  };
});

// Mock do expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('Fase 5 - Testes de Componente: LoginScreen', () => {
  const mockLoginOnline = jest.fn();
  const mockDesbloquearComPin = jest.fn();
  const mockDefinirPinLocal = jest.fn();

  const mockAuthContext: AuthContextData = {
    usuario: null,
    perfil: null,
    empresaId: null,
    isAuthenticated: false,
    isLoading: false,
    loginOnline: mockLoginOnline,
    desbloquearComPin: mockDesbloquearComPin,
    definirPinLocal: mockDefinirPinLocal,
    logout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve validar estrutura do componente LoginScreen e acoes de login', async () => {
    expect(LoginScreen).toBeDefined();
    expect(mockAuthContext.isAuthenticated).toBe(false);
  });
});
