import React, { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useContainer } from './ContainerProvider';

export interface ConectividadeContextData {
  /** Há internet agora? Até a primeira resposta do sistema vale `true`. */
  online: boolean;
  /** Falso só no instante inicial, antes de o sistema responder. */
  conhecida: boolean;
}

const ConectividadeContext = createContext<ConectividadeContextData | null>(null);

/**
 * Estado da conexão para toda a interface.
 *
 * A tela não fala com o NetInfo: lê este contexto, que por sua vez escuta a
 * porta `IConectividadeGateway` do container. É o que permite trocar a rede
 * por um dublê nos testes e manter a apresentação sem dependência de
 * infraestrutura.
 */
export function ConectividadeProvider({ children }: { children: ReactNode }) {
  const { gateways } = useContainer();
  const [online, setOnline] = useState(true);
  const [conhecida, setConhecida] = useState(false);

  useEffect(() => {
    let ativo = true;

    const aplicar = (valor: boolean): void => {
      if (!ativo) return;
      setOnline(valor);
      setConhecida(true);
    };

    gateways.conectividade.estaOnline().then(aplicar, () => aplicar(false));
    const cancelar = gateways.conectividade.observar(aplicar);

    return () => {
      ativo = false;
      cancelar();
    };
  }, [gateways.conectividade]);

  const valor = useMemo(() => ({ online, conhecida }), [online, conhecida]);

  return <ConectividadeContext.Provider value={valor}>{children}</ConectividadeContext.Provider>;
}

export function useConectividade(): ConectividadeContextData {
  const contexto = useContext(ConectividadeContext);

  if (!contexto) {
    throw new Error('useConectividade precisa estar dentro de um ConectividadeProvider');
  }

  return contexto;
}
