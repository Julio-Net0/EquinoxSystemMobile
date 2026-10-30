import {
  EstadoDoBanco,
  IDiagnosticoLocalGateway,
} from '@/domain/gateways/IDiagnosticoLocalGateway';

export class DiagnosticoLocalFake implements IDiagnosticoLocalGateway {
  public estado: EstadoDoBanco = {
    nomeDoArquivo: 'equinox.db',
    versaoDoSchema: 2,
    contagens: {
      empresas: 2,
      enderecos: 6,
      padroes: 7,
      usuarios: 4,
      vinculos: 7,
      leituras: 12,
      notificacoes: 3,
    },
  };

  async coletar(): Promise<EstadoDoBanco> {
    return this.estado;
  }
}
