import { useCallback, useEffect, useState } from 'react';
import { EmpresaOutputDTO } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { CamposEndereco, EnderecoEstruturaDTO } from '@/application/use-cases/GerenciarEstruturaUseCase';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export interface PadraoItem {
  padraoId: string;
  numero: string;
}

export interface EstadoEstrutura {
  empresas: EmpresaOutputDTO[];
  enderecos: EnderecoEstruturaDTO[];
  padroesPorEndereco: Record<string, PadraoItem[]>;
  carregando: boolean;
  erro: string | null;
  processando: boolean;

  /** Empresa aberta; nulo significa a lista de empresas (só super admin). */
  empresaAberta: EmpresaOutputDTO | null;
  abrirEmpresa(empresa: EmpresaOutputDTO | null): void;

  carregarPadroes(enderecoId: string): Promise<void>;
  criarEmpresa(nome: string, cnpj: string): Promise<string | null>;
  criarEndereco(campos: CamposEndereco, numerosDePadrao: string[]): Promise<string | null>;
  atualizarEndereco(enderecoId: string, campos: CamposEndereco): Promise<string | null>;
  excluirEndereco(enderecoId: string): Promise<string | null>;
  criarPadrao(enderecoId: string, numero: string): Promise<string | null>;
  atualizarPadrao(padraoId: string, numero: string, enderecoId: string): Promise<string | null>;
  excluirPadrao(padraoId: string, enderecoId: string): Promise<string | null>;
}

/** Controlador da tela "Gerenciar estrutura". */
export function useEstrutura(): EstadoEstrutura {
  const { usuario, perfil } = useAuth();
  const casos = useCasos();

  const ehSuperAdmin = perfil === PerfilEnum.SUPER_ADMIN;

  const [empresas, setEmpresas] = useState<EmpresaOutputDTO[]>([]);
  const [enderecos, setEnderecos] = useState<EnderecoEstruturaDTO[]>([]);
  const [padroesPorEndereco, setPadroes] = useState<Record<string, PadraoItem[]>>({});
  const [empresaAberta, setEmpresaAberta] = useState<EmpresaOutputDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!usuario) return;

    setCarregando(true);
    setErro(null);

    try {
      if (ehSuperAdmin) {
        setEmpresas(await casos.gerenciarEmpresas.listar());
      }

      const saida = await casos.gerenciarEstrutura.listarEnderecos({
        atorId: usuario.usuarioId,
        // Super admin filtra pela empresa aberta; administrador já é limitado
        // à própria pelo caso de uso.
        empresaId: ehSuperAdmin ? empresaAberta?.id : undefined,
      });

      if (saida.erro) {
        setErro(saida.erro);
        return;
      }
      setEnderecos(saida.enderecos);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [usuario, ehSuperAdmin, empresaAberta, casos.gerenciarEmpresas, casos.gerenciarEstrutura]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const carregarPadroes = useCallback(
    async (enderecoId: string) => {
      // Carrega sob demanda, ao expandir: a lista de endereços não precisa dos
      // padrões de todos de uma vez.
      const lista = await casos.gerenciarEstrutura.listarPadroes({ enderecoId });
      setPadroes((atual) => ({ ...atual, [enderecoId]: lista.padroes }));
    },
    [casos.gerenciarEstrutura],
  );

  /** Envolve uma ação, recarregando no sucesso e devolvendo a mensagem de erro. */
  const agir = useCallback(
    async (
      acao: () => Promise<{ sucesso: boolean; erro?: string }>,
      depois?: () => Promise<void>,
    ): Promise<string | null> => {
      setProcessando(true);
      try {
        const saida = await acao();
        if (!saida.sucesso) return saida.erro ?? 'Não foi possível concluir.';

        await (depois ? depois() : recarregar());
        return null;
      } finally {
        setProcessando(false);
      }
    },
    [recarregar],
  );

  const semSessao = async () => 'Sessão inválida. Entre de novo';

  return {
    empresas,
    enderecos,
    padroesPorEndereco,
    carregando,
    erro,
    processando,
    empresaAberta,
    abrirEmpresa: setEmpresaAberta,
    carregarPadroes,

    criarEmpresa: (nome, cnpj) =>
      usuario
        ? agir(() => casos.gerenciarEmpresas.criar({ atorId: usuario.usuarioId, nome, cnpj }))
        : semSessao(),

    criarEndereco: (campos, numerosDePadrao) =>
      usuario
        ? agir(() =>
            casos.gerenciarEstrutura.criarEndereco({
              atorId: usuario.usuarioId,
              // Super admin cria na empresa aberta; administrador, na sua.
              empresaId: empresaAberta?.id ?? usuario.empresaId ?? '',
              ...campos,
              numerosDePadrao,
            }),
          )
        : semSessao(),

    atualizarEndereco: (enderecoId, campos) =>
      usuario
        ? agir(() =>
            casos.gerenciarEstrutura.atualizarEndereco({
              atorId: usuario.usuarioId,
              enderecoId,
              ...campos,
            }),
          )
        : semSessao(),

    excluirEndereco: (enderecoId) =>
      usuario
        ? agir(() =>
            casos.gerenciarEstrutura.excluirEndereco({
              atorId: usuario.usuarioId,
              enderecoId,
            }),
          )
        : semSessao(),

    criarPadrao: (enderecoId, numero) =>
      usuario
        ? agir(
            () =>
              casos.gerenciarEstrutura.criarPadrao({
                atorId: usuario.usuarioId,
                enderecoId,
                numero,
              }),
            async () => {
              await carregarPadroes(enderecoId);
              await recarregar();
            },
          )
        : semSessao(),

    atualizarPadrao: (padraoId, numero, enderecoId) =>
      usuario
        ? agir(
            () =>
              casos.gerenciarEstrutura.atualizarPadrao({
                atorId: usuario.usuarioId,
                padraoId,
                numero,
              }),
            () => carregarPadroes(enderecoId),
          )
        : semSessao(),

    excluirPadrao: (padraoId, enderecoId) =>
      usuario
        ? agir(
            () =>
              casos.gerenciarEstrutura.excluirPadrao({
                atorId: usuario.usuarioId,
                padraoId,
              }),
            async () => {
              await carregarPadroes(enderecoId);
              await recarregar();
            },
          )
        : semSessao(),
  };
}
