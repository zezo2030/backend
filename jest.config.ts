import type { Config } from 'jest';

const tsJestTransform: [string, Record<string, unknown>] = [
  'ts-jest',
  {
    tsconfig: '<rootDir>/tsconfig.json'
  }
];

const baseProject = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60_000,
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': tsJestTransform
  }
};

const config: Config = {
  rootDir: '.',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts', '!src/worker.ts'],
  coverageDirectory: 'coverage',
  projects: [
    {
      ...baseProject,
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts']
    },
    {
      ...baseProject,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts']
    },
    {
      ...baseProject,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts']
    },
    {
      ...baseProject,
      displayName: 'contract',
      testMatch: ['<rootDir>/test/contract/**/*.spec.ts']
    }
  ]
};

export default config;
