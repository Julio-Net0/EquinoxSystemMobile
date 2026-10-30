import React, { ReactNode, createContext, useContext } from 'react';
import { Container } from '@/infrastructure/di/Container';

const ContainerContext = createContext<Container | null>(null);

export interface ContainerProviderProps {
  container: Container;
  children: ReactNode;
}

/**
 * Entrega o grafo de dependências às telas.
 *
 * Nenhuma tela instancia repositório ou caso de uso: todas chamam `useCasos()`.
 * É o que garante que todas falem com o mesmo banco.
 */
export function ContainerProvider({ container, children }: ContainerProviderProps) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);

  if (!container) {
    throw new Error('useContainer precisa estar dentro de um ContainerProvider');
  }

  return container;
}

export function useCasos(): Container['casos'] {
  return useContainer().casos;
}
