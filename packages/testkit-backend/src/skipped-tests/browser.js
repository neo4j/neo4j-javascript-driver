import skip, { ifStartsWith } from './skip'
const skippedTests = [
  skip(
    'Browser doesn\'t support socket timeouts',
    ifStartsWith('stub.configuration_hints.test_connection_recv_timeout_seconds.TestDirectConnectionRecvTimeout')
  ),
  skip(
    'TLS Tests not implemented for browwer',
    ifStartsWith('tls')
  )
]

export default skippedTests
