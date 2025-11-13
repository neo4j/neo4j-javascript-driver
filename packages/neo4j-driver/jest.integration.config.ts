import jestConfig from './jest.config'

jestConfig.testMatch = ['**/test/?(*.)+(spec|test).[tj]s?(x)', '**/test/rx/?(*.)+(spec|test).[tj]s?(x)', '**/test/internal/?(*.)+(spec|test).[tj]s?(x)']
jestConfig.testNamePattern = '#integration *'

export default jestConfig
