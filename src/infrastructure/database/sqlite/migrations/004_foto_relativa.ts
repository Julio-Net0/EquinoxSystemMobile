import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './Migracao';

/**
 * Troca o caminho absoluto da foto pela referência relativa à pasta do app.
 *
 * Até a versão 3, `foto_local_uri` guardava o endereço completo do arquivo
 * (`file:///…/leituras/<id>.jpg`). Esse endereço muda quando o app é
 * atualizado — no iOS a cada atualização, no Expo Go a cada versão nova dele —
 * e a leitura passava a dizer "foto não encontrada" com o arquivo intacto, só
 * em outro lugar. Daqui em diante o banco guarda `leituras/<id>.jpg`, e o
 * caminho completo é montado a cada uso (`fotoNoAparelho.ts`).
 *
 * Só mexe no que tem `/leituras/` no caminho. Vazio (leitura que veio da
 * nuvem) e o que já é relativo ficam como estão. ADR 10.15.
 */
export const DDL_FOTO_RELATIVA = `
UPDATE leituras
SET foto_local_uri = substr(foto_local_uri, instr(foto_local_uri, '/leituras/') + 1)
WHERE instr(foto_local_uri, '/leituras/') > 0;
`;

export const migracaoFotoRelativa: Migracao = {
  versao: 4,
  nome: '004_foto_relativa',
  async aplicar(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(DDL_FOTO_RELATIVA);
  },
};
