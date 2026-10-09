import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';

export interface SyncContextData {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  forcarSincronizacao: () => Promise<void>;
  atualizarContagemPendentes: () => Promise<void>;
}

export const SyncContext = createContext<SyncContextData>({} as SyncContextData);

export interface SyncProviderProps {
  children: ReactNode;
  actionQueueRepo?: IActionQueueRepository;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children, actionQueueRepo }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const atualizarContagemPendentes = async () => {
    if (actionQueueRepo) {
      try {
        const itens = await actionQueueRepo.obterPendentes();
        setPendingCount(itens.length);
      } catch (err) {
        console.error('Erro ao consultar action_queue:', err);
      }
    }
  };

  useEffect(() => {
    atualizarContagemPendentes();
  }, [actionQueueRepo]);

  const forcarSincronizacao = async (): Promise<void> => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      // Simulação da chamada ao SyncManager Push/Pull
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await atualizarContagemPendentes();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        forcarSincronizacao,
        atualizarContagemPendentes,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextData => useContext(SyncContext);
