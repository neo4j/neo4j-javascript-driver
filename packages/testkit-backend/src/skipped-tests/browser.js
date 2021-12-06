import skip, { ifEndsWith, ifEquals, ifStartsWith } from './skip'
const skippedTests = [
  skip(
    'Browser doesn\'t support socket timeouts',
    ifStartsWith('stub.configuration_hints.test_connection_recv_timeout_seconds')
  ),
  skip(
    'Investigate why websocket is getting too much time to close the connection',
    ifEndsWith('test_should_check_multi_db_support'),
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_fail_on_reset')
  ),
  skip(
    'TLS Tests not implemented for browwer',
    ifStartsWith('tls')
  )
]

export default skippedTests
