import { useState, useEffect, useCallback } from 'react';
import { ConsultarUsinasUseCase, ConsultarUsinasInputDTO } from '@/application/use-cases/ConsultarUsinasUseCase';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { Usina } from '@/domain/entities/Usina';

export interface UseUsinasReturn {
  usinas: Usina[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUsinas(
  usinaRepo: IUsinaRepository,
  input: ConsultarUsinasInputDTO
): UseUsinasReturn {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const carregarUsinas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const useCase = new ConsultarUsinasUseCase(usinaRepo);
      const resultado = await useCase.executar(input);
      setUsinas(resultado);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usinas');
    } finally {
      setIsLoading(false);
    }
  }, [usinaRepo, input.empresaId, input.buscaTexto, input.status]);

  useEffect(() => {
    carregarUsinas();
  }, [carregarUsinas]);

  return {
    usinas,
    isLoading,
    error,
    refetch: carregarUsinas,
  };
}
