import { File, Paths } from 'expo-file-system';

/** Pasta das fotos de leitura, dentro do armazenamento permanente do app. */
export const PASTA_DAS_FOTOS = 'leituras';

/**
 * O que fica gravado no banco para achar a foto: o caminho **relativo** à pasta
 * de documentos do app, como `leituras/<id>.jpg`.
 *
 * Nunca o caminho absoluto. A pasta do app muda de lugar quando ele é
 * atualizado — no iOS a cada atualização, e no Expo Go a cada versão nova do
 * próprio Expo Go —, e um caminho absoluto gravado antes passa a apontar para
 * o nada, mesmo com o arquivo intacto. Ver `docs/decisions.md` seção 10.15.
 */
export function referenciaDaFoto(nomeBase: string): string {
  return `${PASTA_DAS_FOTOS}/${nomeBase}.jpg`;
}

/** `file:///…`, `content://…` ou `/…`: já é um endereço completo. */
const ehAbsoluta = (referencia: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(referencia) || referencia.startsWith('/');

/**
 * O arquivo da foto, resolvido na pasta atual do app. Um caminho absoluto
 * (anterior à migração 004) é usado como está.
 */
export function arquivoDaFoto(referencia: string): File {
  return ehAbsoluta(referencia) ? new File(referencia) : new File(Paths.document, referencia);
}
