import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { Migracao } from './Migracao';
import { migracaoSchemaInicial } from './001_schema_inicial';
import { criarMigracaoSeedDemo } from './002_seed_demo';

export type { Migracao } from './Migracao';
export { DDL_SCHEMA_INICIAL } from './001_schema_inicial';
export { SENHA_DEMO } from './002_seed_demo';

/**
 * Lista de migrações, em ordem de versão.
 *
 * O seed é uma migração própria (versão 2) e não parte do schema: isso permite
 * recriar a estrutura sem os dados de demonstração, e versionar os dois
 * separadamente. Ele recebe o gateway de hash porque as senhas demo precisam
 * ser calculadas, o que SQL puro não faria.
 */
export function criarMigracoes(
  hashSenha: IHashSenhaGateway,
  relogio: IRelogio = relogioSistema,
): Migracao[] {
  return [migracaoSchemaInicial, criarMigracaoSeedDemo(hashSenha, relogio)];
}
