import skip, { ifEndsWith, ifStartsWith } from './skip'
const skippedTests = [
  skip(
    'Browser doesn\'t support socket timeouts',
    ifStartsWith('stub.configuration_hints.test_connection_recv_timeout_seconds.TestDirectConnectionRecvTimeout')
  ),
  skip(
    'Investigate why websocket is getting too much time to close the connection',
    ifEndsWith('test_should_check_multi_db_support')
  ),
  skip(
    'TLS Tests not implemented for browwer',
    ifStartsWith('tls')
  )
]

export default skippedTests
