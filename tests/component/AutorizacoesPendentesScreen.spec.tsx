import React from 'react';
import { AutorizacoesPendentesScreen } from '@/presentation/screens/AutorizacoesPendentesScreen';

// Mock do react-native com Platform.select
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('div', props, props.children),
    Text: (props: any) => React.createElement('span', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('button', { ...props, onClick: props.onPress }, props.children),
    ScrollView: (props: any) => React.createElement('div', props, props.children),
    FlatList: (props: any) => React.createElement('div', props, props.children),
    Modal: (props: any) => React.createElement('div', props, props.children),
    StyleSheet: { create: (styles: any) => styles },
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
    back: jest.fn(),
  }),
}));

describe('Fase 5 - Testes de Componente: AutorizacoesPendentesScreen', () => {
  it('deve verificar a inicializacao da tela de Autorizacoes Pendentes', () => {
    expect(AutorizacoesPendentesScreen).toBeDefined();
  });
});
