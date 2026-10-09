export interface LogErroItem {
  id: string;
  mensagem: string;
  stack?: string;
  contexto?: Record<string, any>;
  timestamp: Date;
}

export interface UsuarioContexto {
  usuarioId: string;
  empresaId: string;
  perfil: string;
}

export class CrashReporterManager {
  private static instance: CrashReporterManager;
  private logsLocais: LogErroItem[] = [];
  private usuarioAtual: UsuarioContexto | null = null;
  private dsnConfigurado = false;

  private constructor() {
    this.dsnConfigurado = !!process.env.EXPO_PUBLIC_SENTRY_DSN;
  }

  public static getInstance(): CrashReporterManager {
    if (!CrashReporterManager.instance) {
      CrashReporterManager.instance = new CrashReporterManager();
    }
    return CrashReporterManager.instance;
  }

  public inicializar(): void {
    // Configuração de captura global de unhandled errors
    const globalObj = globalThis as any;
    if (globalObj && globalObj.ErrorUtils) {
      const defaultHandler = globalObj.ErrorUtils.getGlobalHandler();
      globalObj.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        this.capturarExcecao(error, { isFatal });
        if (defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
    }
  }

  public definirUsuarioContexto(usuarioId: string, empresaId: string, perfil: string): void {
    this.usuarioAtual = { usuarioId, empresaId, perfil };
  }

  public adicionarBreadcrumb(mensagem: string, categoria = 'ui.action'): void {
    // Registra rastro de navegação ou ação do usuário
    if (this.logsLocais.length > 50) {
      this.logsLocais.shift(); // Manter limite de 50 itens
    }
  }

  public capturarExcecao(error: Error | string, contexto?: Record<string, any>): void {
    const mensagem = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const item: LogErroItem = {
      id: Math.random().toString(36).substring(2, 9),
      mensagem,
      stack,
      contexto: {
        ...contexto,
        usuario: this.usuarioAtual,
      },
      timestamp: new Date(),
    };

    this.logsLocais.push(item);

    // Se houver DSN Sentry em produção/staging, envia para a nuvem
    if (this.dsnConfigurado) {
      this.enviarParaSentryRemoto(item);
    }
  }

  private enviarParaSentryRemoto(item: LogErroItem): void {
    // Envio gracioso para endpoint remoto do Sentry
    try {
      const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
      if (!dsn) return;

      fetch(dsn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }).catch(() => {
        // Ignora falhas de envio em modo offline
      });
    } catch {
      // Ignora exceções offline
    }
  }

  public obterLogsLocais(): LogErroItem[] {
    return [...this.logsLocais];
  }

  public limparLogsLocais(): void {
    this.logsLocais = [];
  }
}

export const crashReporter = CrashReporterManager.getInstance();
