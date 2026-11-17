import { arquivoDaFoto } from './fotoNoAparelho';

/**
 * Bytes de um arquivo do armazenamento do app, para o envio do comprovante.
 * Recebe a referência gravada no banco e a resolve na pasta atual do app.
 * Usa a API de objetos do `expo-file-system` (SDK 58), a mesma do
 * `ArquivoFotoGatewayExpo`.
 */
export async function lerArquivoDoAparelho(referencia: string): Promise<ArrayBuffer> {
  return arquivoDaFoto(referencia).arrayBuffer();
}
