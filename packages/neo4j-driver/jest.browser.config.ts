import jestConfig from './jest.integration.config'

export default {
  ...jestConfig,
  resolver: '<rootDir>/test/browser.resolver.js',
  testEnvironment: '<rootDir>/test/browser.environment.js',
  testPathIgnorePatterns: ['<rootDir>/test/examples.test.js']
}
