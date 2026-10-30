import type { SQLiteDatabase } from 'expo-sqlite';
import {
  ContagemTabelas,
  EstadoDoBanco,
  IDiagnosticoLocalGateway,
} from '@/domain/gateways/IDiagnosticoLocalGateway';

/** Tabela de origem de cada contagem exibida. */
const TABELAS: Record<keyof ContagemTabelas, string> = {
  empresas: 'empresas',
  enderecos: 'enderecos',
  padroes: 'padroes_cemig',
  usuarios: 'usuarios',
  vinculos: 'usuario_enderecos',
  leituras: 'leituras',
  notificacoes: 'notificacoes',
};

export class DiagnosticoLocalSQLite implements IDiagnosticoLocalGateway {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly nomeDoArquivo: string,
  ) {}

  async coletar(): Promise<EstadoDoBanco> {
    const versao = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

    const contagens = {} as ContagemTabelas;
    for (const [chave, tabela] of Object.entries(TABELAS)) {
      // O nome da tabela vem do mapa acima, nunca de entrada externa — por
      // isso pode ser interpolado: identificador não aceita parâmetro no SQL.
      const linha = await this.db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total FROM ${tabela}`,
      );
      contagens[chave as keyof ContagemTabelas] = linha?.total ?? 0;
    }

    return {
      nomeDoArquivo: this.nomeDoArquivo,
      versaoDoSchema: versao?.user_version ?? 0,
      contagens,
    };
  }
}
