import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/lib/services/__tests__/**/*.test.ts'],
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['lib/services/**/*.ts', '!lib/services/__tests__/**'],
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
        },
      },
    ],
  },
}

export default config
