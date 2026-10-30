const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * A pasta `example/` guarda o app legado em Tauri: não faz parte do bundle e
 * tem o próprio `node_modules`, instalado com pnpm.
 *
 * Sem excluí-la, o vigia do Metro tenta percorrê-la e morre com EACCES em
 * `example/Equinox.MOBILE/node_modules/.ignored_vitest`, que é um symlink
 * pendurado para um store do pnpm que não existe mais.
 *
 * O blockList padrão é preservado: sobrescrevê-lo quebra a resolução dos
 * chunks de Web Worker (o do `expo-sqlite` na web, por exemplo).
 */
const exclusoes = [/[/\\]example[/\\].*/];

config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, exclusoes)
  : exclusoes;

/**
 * O expo-sqlite na web roda sobre wa-sqlite, cujo motor é um .wasm carregado
 * por um Web Worker. O Metro não trata .wasm como asset por padrão, e sem isto
 * o worker falha a resolver `./wa-sqlite/wa-sqlite.wasm` e o banco nunca abre
 * — a tela fica presa no "Preparando o aparelho".
 */
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;
