import skip, { ifStartsWith } from './skip'
const skippedTests = [
  skip(
    'Stub Tests not implemented for browser',
    ifStartsWith('stub')
  )
]

export default skippedTests
