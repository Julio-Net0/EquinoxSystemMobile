import {
  CredencialEmMemoria,
  IReautenticacaoPendente,
} from '@/domain/gateways/IReautenticacaoPendente';

/**
 * A senha de um login sem rede, só em memória, até o app conseguir entrar na
 * nuvem com ela. Não toca em disco: fechar o app a perde, de propósito.
 */
export class ReautenticacaoEmMemoria implements IReautenticacaoPendente {
  private credencial: CredencialEmMemoria | null = null;

  guardar(credencial: CredencialEmMemoria): void {
    this.credencial = { ...credencial };
  }

  obter(): CredencialEmMemoria | null {
    return this.credencial ? { ...this.credencial } : null;
  }

  limpar(): void {
    this.credencial = null;
  }
}
