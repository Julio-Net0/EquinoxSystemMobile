import { useState } from 'react';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ICameraGateway } from '@/domain/gateways/ICameraGateway';
import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { RegistrarLeituraUseCase } from '@/application/use-cases/RegistrarLeituraUseCase';
import { CameraGatewayFake } from '@/infrastructure/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '@/infrastructure/fakes/LocationGatewayFake';

export interface UseNovaLeituraControllerReturn {
  usinaId: string;
  setUsinaId: (id: string) => void;
  usuarioId: string;
  setUsuarioId: (id: string) => void;
  valorKwh: string;
  setValorKwh: (val: string) => void;
  fotoUri: string | null;
  coordenadas: { lat: number; lng: number } | null;
  loading: boolean;
  erro: string | null;
  sucesso: boolean;
  permissaoNegada: boolean;
  capturarFoto: () => Promise<void>;
  obterGps: () => Promise<void>;
  salvarLeitura: () => Promise<boolean>;
  reset: () => void;
}

export function useNovaLeituraController(
  leituraRepo: ILeituraRepository,
  usinaRepo: IUsinaRepository,
  queueRepo: IActionQueueRepository,
  cameraGateway: ICameraGateway = new CameraGatewayFake(),
  locationGateway: ILocationGateway = new LocationGatewayFake()
): UseNovaLeituraControllerReturn {
  const [usinaId, setUsinaId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [valorKwh, setValorKwh] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [permissaoNegada, setPermissaoNegada] = useState(false);

  const capturarFoto = async () => {
    setErro(null);
    try {
      const permissao = await cameraGateway.solicitarPermissao();
      if (!permissao) {
        setPermissaoNegada(true);
        setErro('Permissão de acesso à câmera negada.');
        return;
      }

      const res = await cameraGateway.capturarEComprimirFoto();
      if (res && res.uri) {
        setFotoUri(res.uri);
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao capturar foto');
    }
  };

  const obterGps = async () => {
    setErro(null);
    try {
      const permissao = await locationGateway.solicitarPermissao();
      if (!permissao) {
        setPermissaoNegada(true);
        setErro('Permissão de localização GPS negada.');
        return;
      }

      const coords = await locationGateway.obterCoordenadas();
      if (coords) {
        setCoordenadas({ lat: coords.latitude, lng: coords.longitude });
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao obter coordenadas GPS');
    }
  };

  const salvarLeitura = async (): Promise<boolean> => {
    setErro(null);
    if (!usinaId) {
      setErro('Selecione a usina.');
      return false;
    }
    if (!valorKwh || isNaN(Number(valorKwh))) {
      setErro('Informe um valor de kWh válido.');
      return false;
    }
    if (!fotoUri) {
      setErro('Capture a foto do relógio medidor.');
      return false;
    }
    if (!coordenadas) {
      setErro('Obtenha as coordenadas GPS antes de salvar.');
      return false;
    }

    setLoading(true);
    try {
      const useCase = new RegistrarLeituraUseCase(leituraRepo, usinaRepo, queueRepo);
      const resultado = await useCase.executar({
        usinaId,
        usuarioId: usuarioId || usinaId, // Fallback se usuarioId não for informado explicitamente
        valorKwh: Number(valorKwh),
        fotoLocalUri: fotoUri,
        latitude: coordenadas.lat,
        longitude: coordenadas.lng,
      });

      if (resultado.sucesso) {
        setSucesso(true);
        return true;
      } else {
        setErro(resultado.erro || 'Falha ao registrar leitura');
        return false;
      }
    } catch (err: any) {
      setErro(err.message || 'Erro inesperado ao salvar leitura');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUsinaId('');
    setUsuarioId('');
    setValorKwh('');
    setFotoUri(null);
    setCoordenadas(null);
    setLoading(false);
    setErro(null);
    setSucesso(false);
    setPermissaoNegada(false);
  };

  return {
    usinaId,
    setUsinaId,
    usuarioId,
    setUsuarioId,
    valorKwh,
    setValorKwh,
    fotoUri,
    coordenadas,
    loading,
    erro,
    sucesso,
    permissaoNegada,
    capturarFoto,
    obterGps,
    salvarLeitura,
    reset,
  };
}
