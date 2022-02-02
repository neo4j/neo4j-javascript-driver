import skip, { ifEndsWith, ifEquals, ifStartsWith } from './skip'
const skippedTests = [
  skip(
    "Browser doesn't support socket timeouts",
    ifStartsWith('stub.configuration_hints.test_connection_recv_timeout_seconds')
  ),
  skip(
    'Investigate why websocket is taking too much time to close the connection',
    ifEndsWith('test_should_check_multi_db_support'),
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_fail_on_reset'),
    ifEquals('stub.tx_begin_parameters.test_tx_begin_parameters.TestTxBeginParameters.test_impersonation_fails_on_v4x3'),
    ifEquals('stub.session_run_parameters.test_session_run_parameters.TestSessionRunParameters.test_impersonation_fails_on_v4x3'),
  ),
  skip(
    'TLS Tests not implemented for browwer',
    ifStartsWith('tls')
  )
]

export default skippedTests
