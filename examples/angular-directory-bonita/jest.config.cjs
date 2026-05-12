/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  testEnvironment: 'jsdom',
  // jest-preset-angular already wires setup-jest internally; project-specific
  // hooks (MSW, jest-dom) can be added by extending setup-jest.ts and
  // referencing it here once you confirm the correct option name for your
  // jest-preset-angular version.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/test-setup.ts',
    '!src/mocks/**',
    '!src/main.ts',
    '!src/polyfills.ts',
  ],
  coverageThreshold: {
    'src/app/api/': { lines: 80, functions: 80, branches: 75 },
    'src/app/services/': { lines: 80, functions: 80, branches: 75 },
    'src/app/stores/': { lines: 80, functions: 80, branches: 75 },
  },
  transformIgnorePatterns: ['node_modules/(?!(@angular|rxjs|msw|@bundled-es-modules)/.*)'],
};
