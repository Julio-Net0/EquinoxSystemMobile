import { File } from 'expo-file-system';

/**
 * Bytes de um arquivo do armazenamento do app, para o envio do comprovante.
 * Usa a API de objetos do `expo-file-system` (SDK 58), a mesma do
 * `ArquivoFotoGatewayExpo`.
 */
export async function lerArquivoDoAparelho(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
