const alias = { '^@/(.*)$': '<rootDir>/src/$1' };

// Pacotes publicados em ESM/Flow que precisam passar pelo transform do jest-expo.
const transformIgnore = [
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*'
    + '|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@testing-library/react-native'
    + '|test-renderer|react-native-svg))',
];

module.exports = {
  projects: [
    {
      // Domínio, aplicação e arquitetura são puros, mas usam o mesmo preset dos
      // outros projetos de propósito: com transforms diferentes (ts-jest aqui,
      // Babel lá) um arquivo carregado por dois projetos gerava dois mapas de
      // cobertura incompatíveis, e o merge do istanbul somava errado. Quem
      // checa tipos é o `tsc --noEmit` do gate, não o executor de teste.
      displayName: 'dominio',
      preset: 'jest-expo',
      testEnvironment: 'node',
      transformIgnorePatterns: transformIgnore,
      testMatch: [
        '<rootDir>/tests/unit/domain/**/*.spec.ts',
        '<rootDir>/tests/unit/application/**/*.spec.ts',
        '<rootDir>/tests/unit/arquitetura/**/*.spec.ts',
      ],
      moduleNameMapper: alias,
    },
    {
      // Infraestrutura toca módulos do Expo, então precisa do preset nativo.
      displayName: 'infra',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/unit/infrastructure/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
      moduleNameMapper: alias,
      transformIgnorePatterns: transformIgnore,
    },
    {
      // Integração: SQLite de verdade (node:sqlite) contra o schema publicado.
      // Precisa do preset nativo porque emTransacao consulta Platform.OS.
      displayName: 'integracao',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
      moduleNameMapper: alias,
      transformIgnorePatterns: transformIgnore,
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/component/**/*.spec.tsx'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
      moduleNameMapper: alias,
      transformIgnorePatterns: transformIgnore,
    },
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/infrastructure/**/*.ts',
    '!src/**/*.d.ts',
    '!src/infrastructure/fakes/**',
  ],
};
