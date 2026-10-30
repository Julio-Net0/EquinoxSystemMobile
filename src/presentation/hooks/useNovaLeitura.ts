import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EnderecoCatalogoDTO,
  PadraoCatalogoDTO,
} from '@/application/use-cases/ConsultarCatalogoUseCase';
import { CoordenadasInput } from '@/application/use-cases/RegistrarLeituraUseCase';
import { useContainer, useCasos } from '@/presentation/context/ContainerProvider';
import { useAuth } from './useAuth';

export type SituacaoGps = 'buscando' | 'obtido' | 'indisponivel';

export interface EstadoNovaLeitura {
  carregando: boolean;
  erro: string | null;
  endereco: EnderecoCatalogoDTO | null;
  padrao: PadraoCatalogoDTO | null;

  consumo: string;
  injecao: string;
  setConsumo(valor: string): void;
  setInjecao(valor: string): void;

  fotoUri: string | null;
  capturarFoto(): Promise<void>;

  gps: SituacaoGps;
  coordenadas: CoordenadasInput | null;
  obterGps(): Promise<void>;

  salvando: boolean;
  avisoValorMenor: string | null;
  sucesso: boolean;
  salvar(): Promise<void>;
  confirmarValorMenor(): Promise<void>;
  cancelarAviso(): void;
}

/** Converte o texto do campo (que aceita vírgula) em número. */
const paraNumero = (texto: string): number => {
  const limpo = texto.trim().replace(',', '.');
  return limpo === '' ? Number.NaN : Number(limpo);
};

/**
 * Controlador da tela de leitura.
 *
 * O GPS é buscado em segundo plano ao abrir, em vez de exigir um toque: o
 * técnico está de pé na frente do medidor e a localização é prova de apoio, não
 * uma etapa do trabalho dele. Se não vier, a leitura segue sem ela.
 */
export function useNovaLeitura(padraoId: string): EstadoNovaLeitura {
  const { usuario } = useAuth();
  const casos = useCasos();
  const { gateways } = useContainer();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<EnderecoCatalogoDTO | null>(null);

  const [consumo, setConsumo] = useState('');
  const [injecao, setInjecao] = useState('');

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [gps, setGps] = useState<SituacaoGps>('buscando');
  const [coordenadas, setCoordenadas] = useState<CoordenadasInput | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [avisoValorMenor, setAvisoValorMenor] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const padrao = useMemo(
    () => endereco?.padroes.find((p) => p.padraoId === padraoId) ?? null,
    [endereco, padraoId],
  );

  // Carrega o contexto do padrão a partir do catálogo do próprio usuário: isso
  // já garante que ele só lê padrão de endereço a que tem acesso.
  useEffect(() => {
    if (!usuario) return;

    let ativo = true;

    (async () => {
      try {
        const catalogo = await casos.consultarCatalogo.executar({
          usuarioId: usuario.usuarioId,
        });
        if (!ativo) return;

        const dono = catalogo.enderecos.find((e) =>
          e.padroes.some((p) => p.padraoId === padraoId),
        );

        if (!dono) {
          setErro('Padrão não encontrado entre os seus endereços.');
        } else {
          setEndereco(dono);
        }
      } catch (falha) {
        if (ativo) setErro((falha as Error).message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [usuario, padraoId, casos.consultarCatalogo]);

  const obterGps = useCallback(async () => {
    setGps('buscando');

    const permitido =
      (await gateways.location.temPermissao()) || (await gateways.location.solicitarPermissao());

    if (!permitido) {
      setGps('indisponivel');
      return;
    }

    const coords = await gateways.location.obterCoordenadas();

    if (!coords) {
      setGps('indisponivel');
      return;
    }

    setCoordenadas({
      latitude: coords.latitude,
      longitude: coords.longitude,
      precisaoMetros: coords.precisaoMetros ?? undefined,
    });
    setGps('obtido');
  }, [gateways.location]);

  useEffect(() => {
    void obterGps();
  }, [obterGps]);

  const capturarFoto = useCallback(async () => {
    setErro(null);

    try {
      const foto = await gateways.camera.capturar();
      // Nulo quando o usuário fecha sem bater a foto.
      if (foto) setFotoUri(foto.uri);
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }, [gateways.camera]);

  const registrar = useCallback(
    async (confirmouValorMenor: boolean) => {
      if (!usuario || !fotoUri) return;

      setSalvando(true);
      setErro(null);

      try {
        const saida = await casos.registrarLeitura.executar({
          padraoId,
          usuarioId: usuario.usuarioId,
          valorConsumo: paraNumero(consumo),
          valorInjecao: endereco?.ehUsina ? paraNumero(injecao) : null,
          fotoTemporariaUri: fotoUri,
          coordenadas,
          confirmouValorMenor,
        });

        if (saida.precisaConfirmar) {
          setAvisoValorMenor(saida.aviso ?? null);
          return;
        }

        if (!saida.sucesso) {
          setErro(saida.erro ?? 'Não foi possível registrar a leitura.');
          return;
        }

        setAvisoValorMenor(null);
        setSucesso(true);
      } finally {
        setSalvando(false);
      }
    },
    [usuario, fotoUri, casos.registrarLeitura, padraoId, consumo, injecao, endereco, coordenadas],
  );

  const salvar = useCallback(async () => {
    if (!fotoUri) {
      setErro('Tire a foto do visor do medidor antes de registrar.');
      return;
    }
    await registrar(false);
  }, [fotoUri, registrar]);

  return {
    carregando,
    erro,
    endereco,
    padrao,
    consumo,
    injecao,
    setConsumo,
    setInjecao,
    fotoUri,
    capturarFoto,
    gps,
    coordenadas,
    obterGps,
    salvando,
    avisoValorMenor,
    sucesso,
    salvar,
    confirmarValorMenor: () => registrar(true),
    cancelarAviso: () => setAvisoValorMenor(null),
  };
}
