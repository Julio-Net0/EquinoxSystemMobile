import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ListaUsinasScreen } from '@/presentation/screens/ListaUsinasScreen';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { useAuth } from '@/presentation/hooks/useAuth';

export default function UsinasRoute() {
  const router = useRouter();
  const { empresaId } = useAuth();
  const defaultEmpresaId = empresaId || '550e8400-e29b-41d4-a716-446655440000';

  const usinaRepo = useMemo(() => {
    const repo = new UsinaRepositoryMemory();
    const empId = new UUIDv4(defaultEmpresaId);

    repo.salvar(
      new Usina({
        id: new UUIDv4('f47ac10b-58cc-4372-a567-0e02b2c3d4e5'),
        empresaId: empId,
        nome: 'Usina Fazenda Sol 01',
        codigoUC: 'UC-998877',
        capacidadeNominal: 500,
        coordenadas: new CoordenadasGPS(-23.55052, -46.633308),
        status: StatusUsinaEnum.ATIVA,
      })
    );

    repo.salvar(
      new Usina({
        id: new UUIDv4('c1234567-89ab-4cde-8f01-234567890abc'),
        empresaId: empId,
        nome: 'Usina Solar Campo Verde',
        codigoUC: 'UC-334455',
        capacidadeNominal: 750,
        coordenadas: new CoordenadasGPS(-23.60000, -46.700000),
        status: StatusUsinaEnum.EM_COMISSIONAMENTO,
      })
    );

    return repo;
  }, [defaultEmpresaId]);

  return (
    <ListaUsinasScreen
      empresaId={defaultEmpresaId}
      usinaRepo={usinaRepo}
      onSelecionarUsina={(usina) => router.push(`/leitura/nova?usinaId=${usina.id.value}` as any)}
      onNovaUsina={() => router.push('/usina/nova' as any)}
    />
  );
}
