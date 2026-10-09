import { CrashReporterManager } from '@/infrastructure/monitoring/CrashReporterManager';

describe('Fase 5 - CrashReporterManager & Sentry RNF09', () => {
  let manager: CrashReporterManager;

  beforeEach(() => {
    manager = CrashReporterManager.getInstance();
    manager.limparLogsLocais();
  });

  it('deve registrar exceções e manter histórico local', () => {
    manager.capturarExcecao(new Error('Erro de teste de conexão SQLite'), { contexto: 'Sync' });

    const logs = manager.obterLogsLocais();
    expect(logs.length).toBe(1);
    expect(logs[0].mensagem).toBe('Erro de teste de conexão SQLite');
    expect(logs[0].contexto?.contexto).toBe('Sync');
  });

  it('deve vincular dados de contexto de usuário sem expor dados sensíveis', () => {
    manager.definirUsuarioContexto('user-123', 'empresa-456', 'Leitor');
    manager.capturarExcecao('Falha na câmera');

    const logs = manager.obterLogsLocais();
    expect(logs.length).toBe(1);
    expect(logs[0].contexto?.usuario).toEqual({
      usuarioId: 'user-123',
      empresaId: 'empresa-456',
      perfil: 'Leitor',
    });
  });

  it('deve limpar os logs locais quando solicitado', () => {
    manager.capturarExcecao('Erro 1');
    manager.capturarExcecao('Erro 2');
    expect(manager.obterLogsLocais().length).toBe(2);

    manager.limparLogsLocais();
    expect(manager.obterLogsLocais().length).toBe(0);
  });
});
