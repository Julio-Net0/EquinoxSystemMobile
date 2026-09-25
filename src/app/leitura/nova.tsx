import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NovaLeituraScreen } from '@/presentation/screens/NovaLeituraScreen';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';
import { CameraGatewayFake } from '@/infrastructure/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '@/infrastructure/fakes/LocationGatewayFake';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function NovaLeituraRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ usinaId?: string }>();
  const { usuario } = useAuth();

  const targetUsinaId = params.usinaId || 'f47ac10b-58cc-4372-a567-0e02b2c3d4e5';
  const targetUsuarioId = usuario?.usuarioId || 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  const leituraRepo = useMemo(() => new LeituraRepositoryMemory(), []);
  const queueRepo = useMemo(() => new ActionQueueRepositoryMemory(), []);
  const cameraGateway = useMemo(() => new CameraGatewayFake(), []);
  const locationGateway = useMemo(() => new LocationGatewayFake(), []);

  const usinaRepo = useMemo(() => {
    const repo = new UsinaRepositoryMemory();
    repo.salvar(
      new Usina({
        id: new UUIDv4(targetUsinaId),
        empresaId: new UUIDv4('550e8400-e29b-41d4-a716-446655440000'),
        nome: 'Usina Fazenda Sol 01',
        codigoUC: 'UC-998877',
        capacidadeNominal: 500,
        coordenadas: new CoordenadasGPS(-23.55052, -46.633308),
        status: StatusUsinaEnum.ATIVA,
      })
    );
    return repo;
  }, [targetUsinaId]);

  return (
    <NovaLeituraScreen
      usinaId={targetUsinaId}
      usuarioId={targetUsuarioId}
      leituraRepo={leituraRepo}
      usinaRepo={usinaRepo}
      queueRepo={queueRepo}
      cameraGateway={cameraGateway}
      locationGateway={locationGateway}
      onSucesso={() => router.back()}
    />
  );
}
