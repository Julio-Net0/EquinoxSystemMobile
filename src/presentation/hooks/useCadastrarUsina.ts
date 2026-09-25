import { useState } from 'react';
import { CadastrarUsinaUseCase, CadastrarUsinaInputDTO } from '@/application/use-cases/CadastrarUsinaUseCase';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';

export interface UseCadastrarUsinaReturn {
  isSaving: boolean;
  error: string | null;
  cadastrarUsina: (input: CadastrarUsinaInputDTO) => Promise<boolean>;
}

export function useCadastrarUsina(
  usinaRepo: IUsinaRepository,
  queueRepo: IActionQueueRepository
): UseCadastrarUsinaReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cadastrarUsina = async (input: CadastrarUsinaInputDTO): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const useCase = new CadastrarUsinaUseCase(usinaRepo, queueRepo);
      const resultado = await useCase.executar(input);

      if (resultado.sucesso) {
        return true;
      } else {
        setError(resultado.erro || 'Erro ao cadastrar usina');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao cadastrar usina');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    error,
    cadastrarUsina,
  };
}
