import { PainelSincronizacaoProps } from '@/presentation/components/PainelSincronizacao';
import { useConectividade } from '@/presentation/context/ConectividadeContext';
import { useSincronizacao } from '@/presentation/context/SincronizacaoContext';

/**
 * Junta os dois contextos (conexão e sincronização) no formato que o
 * `PainelSincronizacao` recebe. As telas continuam sem saber de onde vem o
 * estado da rede.
 */
export function usePainelSincronizacao(): PainelSincronizacaoProps {
  const { online } = useConectividade();
  const sync = useSincronizacao();

  return {
    online,
    sincronizando: sync.sincronizando,
    pendentes: sync.pendentes,
    isolados: sync.isolados,
    ultimaSincronizacaoEm: sync.ultimaSincronizacaoEm,
    aviso: sync.aviso,
    onSincronizar: () => void sync.sincronizar(),
    onTentarDeNovo: () => void sync.tentarDeNovo(),
  };
}
