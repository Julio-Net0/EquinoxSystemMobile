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
      // Domínio e aplicação são puros: rodam em Node, sem o custo do transform de RN.
      displayName: 'dominio',
      preset: 'ts-jest',
      testEnvironment: 'node',
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
  ],
};
