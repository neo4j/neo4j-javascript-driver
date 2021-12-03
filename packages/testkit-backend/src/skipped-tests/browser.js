import skip, { ifStartsWith } from './skip'
const skippedTests = [
  skip(
    'Stub Tests not implemented for browser',
    ifStartsWith('stub')
  ),
  skip(
    'TLS Tests not implemented for browwer',
    ifStartsWith('tls')
  )
]

export default skippedTests
