import skip, { ifStartsWith } from './skip'
const skippedTests = [
  skip(
    'TLS Tests not implemented for browwer',
    ifStartsWith('tls')
  )
]

export default skippedTests
