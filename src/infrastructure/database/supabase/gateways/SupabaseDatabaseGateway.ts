import { IRemoteDatabaseGateway } from '@/domain/gateways/IRemoteDatabaseGateway';
import { Leitura } from '@/domain/entities/Leitura';
import { Usina } from '@/domain/entities/Usina';
import { Usuario } from '@/domain/entities/Usuario';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';
import { supabase } from '../supabaseClient';

export class SupabaseDatabaseGateway implements IRemoteDatabaseGateway {
  private readonly TIMEOUT_MS = 300;

  private async comTimeout<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    let timerId: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timerId = setTimeout(() => resolve(fallback), this.TIMEOUT_MS);
      if (timerId && typeof timerId.unref === 'function') {
        timerId.unref();
      }
    });
    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timerId);
      return result;
    } catch {
      clearTimeout(timerId);
      return fallback;
    }
  }

  async enviarLeitura(leitura: Leitura): Promise<boolean> {
    return this.comTimeout(async () => {
      const { error } = await supabase.from('leituras').upsert({
        id: leitura.id.value,
        usina_id: leitura.usinaId.value,
        usuario_id: leitura.usuarioId.value,
        leitura_kwh: leitura.valorKwh.valor,
        data_hora: leitura.dataHora.toISOString(),
        caminho_imagem_local: leitura.caminhoImagemLocal,
        url_imagem_remota: leitura.urlImagemRemota,
        latitude: leitura.coordenadas.latitude,
        longitude: leitura.coordenadas.longitude,
        status_sync: 'Sincronizado',
      });
      return !error;
    }, false);
  }

  async enviarUsina(usina: Usina): Promise<boolean> {
    return this.comTimeout(async () => {
      const { error } = await supabase.from('usinas').upsert({
        id: usina.id.value,
        empresa_id: usina.empresaId.value,
        nome: usina.nome,
        capacidade_kwp: usina.capacidadeNominal,
        latitude: usina.coordenadas.latitude,
        longitude: usina.coordenadas.longitude,
        status: usina.status,
      });
      return !error;
    }, false);
  }

  async enviarUsuario(usuario: Usuario): Promise<boolean> {
    return this.comTimeout(async () => {
      const { error } = await supabase.from('usuarios').upsert({
        id: usuario.id.value,
        empresa_id: usuario.empresaId.value,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        ativo: usuario.isAtivo(),
      });
      return !error;
    }, false);
  }

  async enviarEmpresa(empresa: Empresa): Promise<boolean> {
    return this.comTimeout(async () => {
      const { error } = await supabase.from('empresas').upsert({
        id: empresa.id.value,
        nome_fantasia: empresa.nome,
        razao_social: empresa.nome,
        cnpj: empresa.cnpj.valorLimpo,
        ativa: true,
      });
      return !error;
    }, false);
  }

  async buscarNovasLeituras(empresaId: string, desde: Date): Promise<Leitura[]> {
    return this.comTimeout(async () => {
      const { data, error } = await supabase
        .from('leituras')
        .select('*')
        .gte('created_at', desde.toISOString());

      if (error || !data) return [];

      return data.map((item: any) => new Leitura({
        id: new UUIDv4(item.id),
        usinaId: new UUIDv4(item.usina_id),
        usuarioId: new UUIDv4(item.usuario_id),
        valorKwh: new ValorKwh(Number(item.leitura_kwh)),
        caminhoImagemLocal: item.caminho_imagem_local || item.url_imagem_remota || 'comprovante.jpg',
        urlImagemRemota: item.url_imagem_remota,
        coordenadas: new CoordenadasGPS(Number(item.latitude || 0), Number(item.longitude || 0)),
        statusSync: StatusSyncEnum.SINCRONIZADA,
        dataHora: new Date(item.data_hora),
      }));
    }, []);
  }

  async buscarNovasUsinas(empresaId: string, desde: Date): Promise<Usina[]> {
    return this.comTimeout(async () => {
      const { data, error } = await supabase
        .from('usinas')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('created_at', desde.toISOString());

      if (error || !data) return [];

      return data.map((item: any) => new Usina({
        id: new UUIDv4(item.id),
        empresaId: new UUIDv4(item.empresa_id),
        nome: item.nome,
        codigoUC: item.codigo_uc || `UC-${item.id.substring(0, 6)}`,
        capacidadeNominal: Number(item.capacidade_kwp),
        coordenadas: new CoordenadasGPS(Number(item.latitude || 0), Number(item.longitude || 0)),
        status: (item.status as StatusUsinaEnum) || StatusUsinaEnum.ATIVA,
      }));
    }, []);
  }
}
