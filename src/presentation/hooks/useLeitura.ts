import { useState } from 'react';
import { RegistrarLeituraUseCase, RegistrarLeituraInputDTO } from '@/application/use-cases/RegistrarLeituraUseCase';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';

export interface UseLeituraReturn {
  isSubmitting: boolean;
  error: string | null;
  isSuccess: boolean;
  registrarLeitura: (input: RegistrarLeituraInputDTO) => Promise<boolean>;
  reset: () => void;
}

export function useLeitura(
  leituraRepo: ILeituraRepository,
  usinaRepo: IUsinaRepository,
  queueRepo: IActionQueueRepository
): UseLeituraReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const registrarLeitura = async (input: RegistrarLeituraInputDTO): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      const useCase = new RegistrarLeituraUseCase(leituraRepo, usinaRepo, queueRepo);
      const resultado = await useCase.executar(input);

      if (resultado.sucesso) {
        setIsSuccess(true);
        return true;
      } else {
        setError(resultado.erro || 'Erro ao registrar leitura');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setIsSubmitting(false);
    setError(null);
    setIsSuccess(false);
  };

  return {
    isSubmitting,
    error,
    isSuccess,
    registrarLeitura,
    reset,
  };
}
