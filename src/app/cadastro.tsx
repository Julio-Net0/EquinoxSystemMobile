import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { EmpresaParaCadastro } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { CadastroScreen } from '@/presentation/screens/CadastroScreen';
import { useCasos } from '@/presentation/context/ContainerProvider';

/**
 * O cadastro acontece na nuvem, antes de existir sessão. A lista de empresas
 * vem de uma função do servidor aberta a anônimos que só devolve id e nome —
 * a tabela em si não é legível sem login.
 */
export default function CadastroRoute() {
  const router = useRouter();
  const casos = useCasos();

  const [empresas, setEmpresas] = useState<EmpresaParaCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const saida = await casos.cadastrarPendente.buscarEmpresas('');
    setEmpresas(saida.empresas);
    setAviso(saida.erro ?? null);
    setCarregando(false);
  }, [casos.cadastrarPendente]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const itens = useMemo(() => empresas.map((e) => ({ id: e.id, rotulo: e.nome })), [empresas]);

  return (
    <CadastroScreen
      empresas={itens}
      carregandoEmpresas={carregando}
      avisoEmpresas={aviso}
      onRecarregarEmpresas={() => void carregar()}
      onEnviar={async (dados) => {
        const saida = await casos.cadastrarPendente.executar(dados);
        return { sucesso: saida.sucesso, erro: saida.erro };
      }}
      onVoltarAoLogin={() => router.replace('/login')}
    />
  );
}
