import React from 'react';
import { NotificacoesScreen } from '@/presentation/screens/NotificacoesScreen';
import { useNotificacoes } from '@/presentation/hooks/useNotificacoes';

export default function NotificacoesRoute() {
  const estado = useNotificacoes();

  return (
    <NotificacoesScreen
      notificacoes={estado.notificacoes}
      temMais={estado.temMais}
      carregando={estado.carregando}
      erro={estado.erro}
      decidindoId={estado.decidindoId}
      onCarregarMais={() => void estado.carregarMais()}
      onMarcarLida={(id) => void estado.marcarLida(id)}
      onMarcarTodasLidas={() => void estado.marcarTodasLidas()}
      onDecidir={(id, decisao) => void estado.decidir(id, decisao)}
    />
  );
}
