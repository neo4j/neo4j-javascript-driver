import jestConfig from './jest.integration.config'

export default {
  ...jestConfig,
  resolver: '<rootDir>/test/browser.resolver.js',
  testEnvironment: '<rootDir>/test/browser.environment.js',
  testPathIgnorePatterns: ['<rootDir>/test/examples.test.js', '<rootDir>/test/bolt-v3.test.js', '<rootDir>/test/stress.test.js']
}
