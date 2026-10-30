import { useCallback, useEffect, useState } from 'react';
import { EnderecoCatalogoDTO } from '@/application/use-cases/ConsultarCatalogoUseCase';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export interface EstadoHome {
  carregando: boolean;
  erro: string | null;
  enderecos: EnderecoCatalogoDTO[];
  avisosNaoLidos: number;
  recarregar(): Promise<void>;
}

/**
 * Dados da tela inicial: o catálogo do técnico e, para administrador, a
 * contagem de avisos não lidos do badge.
 *
 * A contagem falhar não impede a Home de abrir — no app antigo o badge
 * simplesmente não aparecia, e esse comportamento é preservado.
 */
export function useHome(): EstadoHome {
  const { usuario, perfil } = useAuth();
  const casos = useCasos();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enderecos, setEnderecos] = useState<EnderecoCatalogoDTO[]>([]);
  const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);

  const recarregar = useCallback(async () => {
    if (!usuario) return;

    setCarregando(true);
    setErro(null);

    try {
      const catalogo = await casos.consultarCatalogo.executar({ usuarioId: usuario.usuarioId });
      setEnderecos(catalogo.enderecos);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }

    if (perfil === PerfilEnum.ADMIN || perfil === PerfilEnum.SUPER_ADMIN) {
      try {
        const { total } = await casos.notificacoes.contarNaoLidas({ atorId: usuario.usuarioId });
        setAvisosNaoLidos(total);
      } catch {
        setAvisosNaoLidos(0);
      }
    }
  }, [usuario, perfil, casos.consultarCatalogo, casos.notificacoes]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { carregando, erro, enderecos, avisosNaoLidos, recarregar };
}
