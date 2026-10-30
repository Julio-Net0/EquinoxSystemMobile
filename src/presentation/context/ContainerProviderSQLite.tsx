import React, { ReactNode, createContext, useContext, useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { ContainerProvider } from './ContainerProvider';
import { CameraGatewayExpo } from '@/infrastructure/hardware/camera/CameraGatewayExpo';
import { criarContainerSQLite } from '@/infrastructure/di/criarContainerSQLite';

/**
 * O gateway concreto da câmera, separado do container porque só o componente de
 * captura precisa dele — é nele que a CameraView registra o capturador.
 */
const CameraExpoContext = createContext<CameraGatewayExpo | null>(null);

export function useCameraExpo(): CameraGatewayExpo {
  const camera = useContext(CameraExpoContext);

  if (!camera) {
    throw new Error('useCameraExpo precisa estar dentro de um ContainerProviderSQLite');
  }

  return camera;
}

/**
 * Único lugar do app que toca `useSQLiteContext`. Monta o grafo real a partir
 * do banco já aberto e migrado pelo SQLiteProvider.
 */
export function ContainerProviderSQLite({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const container = useMemo(() => criarContainerSQLite(db), [db]);

  return (
    <CameraExpoContext.Provider value={container.cameraGatewayExpo}>
      <ContainerProvider container={container}>{children}</ContainerProvider>
    </CameraExpoContext.Provider>
  );
}
