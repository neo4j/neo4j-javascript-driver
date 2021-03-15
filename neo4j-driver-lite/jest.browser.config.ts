import jestConfig from './jest.integration.config'

export default {
  ...jestConfig,
  resolver: '<rootDir>/test/integration/browser.resolver.js',
  testEnvironment: '<rootDir>/test/integration/browser.environment.js'
}
