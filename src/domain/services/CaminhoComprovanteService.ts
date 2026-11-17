import { UUIDv4 } from '../value-objects/UUIDv4';

/**
 * Caminho do comprovante de uma leitura no armazenamento remoto:
 * `{empresa}/{endereco}/{leitura}.jpg`.
 *
 * A ordem dos segmentos não é estética: as regras de acesso do bucket
 * conferem o primeiro (empresa) e o segundo (endereço) para decidir quem pode
 * enviar e ver a foto. O nome do arquivo é o id da leitura, o que torna o
 * envio repetível — reenviar a mesma foto cai sempre no mesmo lugar.
 */
export class CaminhoComprovanteService {
  public static de(empresaId: UUIDv4, enderecoId: UUIDv4, leituraId: UUIDv4): string {
    return `${empresaId.value}/${enderecoId.value}/${leituraId.value}.jpg`;
  }
}
