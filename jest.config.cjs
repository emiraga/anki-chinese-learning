module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/app'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/app/$1',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        verbatimModuleSyntax: false,
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'esnext',
        moduleResolution: 'node',
      }
    }
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        verbatimModuleSyntax: false,
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'esnext',
        moduleResolution: 'node',
      }
    }]
  },
};
