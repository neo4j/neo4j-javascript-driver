import jestConfig from './jest.config'

jestConfig.testMatch = ['**/test/integration/?(*.)+(spec|test).[tj]s?(x)']

export default jestConfig
