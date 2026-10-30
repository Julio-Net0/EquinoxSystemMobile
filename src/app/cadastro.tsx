import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { EmpresaOutputDTO } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { CadastroScreen } from '@/presentation/screens/CadastroScreen';
import { useCasos } from '@/presentation/context/ContainerProvider';

export default function CadastroRoute() {
  const router = useRouter();
  const casos = useCasos();

  const [empresas, setEmpresas] = useState<EmpresaOutputDTO[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const lista = await casos.gerenciarEmpresas.listar();
        if (ativo) setEmpresas(lista);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [casos.gerenciarEmpresas]);

  const itens = useMemo(
    () => empresas.map((e) => ({ id: e.id, rotulo: e.nome, sublinha: e.cnpj })),
    [empresas],
  );

  return (
    <CadastroScreen
      empresas={itens}
      carregandoEmpresas={carregando}
      onEnviar={async (dados) => {
        const saida = await casos.cadastrarPendente.executar(dados);
        return { sucesso: saida.sucesso, erro: saida.erro };
      }}
      onVoltarAoLogin={() => router.replace('/login')}
    />
  );
}
