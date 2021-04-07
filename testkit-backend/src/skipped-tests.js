function ifEndsWith (suffix) {
  return testName => testName.endsWith(suffix)
}

function ifStartsWith (prefix) {
  return testName => testName.startsWith(prefix)
}

function ifEquals (expectedName) {
  return testName => testName === expectedName
}

function or () {
  return testName => [...arguments].find(predicate => predicate(testName))
}

function skip (reason, predicate) {
  return { reason, predicate }
}

const skippedTests = [
  skip(
    'Routing tests are disabled until the fix on the test scenario be merged',
    or(ifStartsWith('stub.routing'), ifStartsWith('stub.retry.TestRetry'))
  ),
  skip(
    'Driver is failing trying to update the routing table using the original routing server',
    ifEndsWith(
      'test_should_use_initial_router_for_discovery_when_others_unavailable'
    )
  ),
  skip(
    'Driver is creating a dedicated connection to check the MultiDBSupport',
    ifEndsWith(
      'test_should_successfully_check_if_support_for_multi_db_is_available'
    )
  ),
  skip(
    'Driver should implement resolver',
    or(
      ifEndsWith(
        'test_should_revert_to_initial_router_if_known_router_throws_protocol_errors'
      ),
      ifEndsWith(
        'test_should_use_resolver_during_rediscovery_when_existing_routers_fail'
      )
    )
  ),
  skip(
    'Test are not consuming the values inside the try catch',
    or(
      ifEndsWith('test_should_retry_read_tx_and_rediscovery_until_success'),
      ifEndsWith('test_should_retry_write_tx_and_rediscovery_until_success'),
      ifEndsWith('test_should_retry_write_tx_until_success'),
      ifEndsWith(
        'test_should_read_successfully_from_reachable_db_after_trying_unreachable_db'
      ),
      ifEndsWith(
        'test_should_retry_write_until_success_with_leader_shutdown_during_tx_using_tx_function'
      )
    )
  ),
  skip(
    'Requires investigation',
    or(
      ifEndsWith(
        'test_should_fail_when_writing_without_explicit_consumption_on_writer_that_returns_not_a_leader_code'
      ),
      ifEndsWith(
        'test_should_fail_when_writing_on_unexpectedly_interrupting_writer_using_session_run'
      ),
      ifEndsWith(
        'test_should_fail_with_routing_failure_on_db_not_found_discovery_failure'
      ),
      ifEndsWith(
        'test_should_retry_write_until_success_with_leader_change_using_tx_function'
      ),
      ifEndsWith(
        'test_should_request_rt_from_all_initial_routers_until_successful'
      ),
      ifEndsWith('test_should_pass_bookmark_from_tx_to_tx_using_tx_run'),
      ifEndsWith('test_should_successfully_get_routing_table_with_context'),
      ifStartsWith('stub.transport.Transport')
    )
  ),
  skip(
    'Should implement result.consume',
    ifEquals('neo4j.sessionrun.TestSessionRun.test_updates_last_bookmark')
  ),
  skip(
    'It could not guarantee the order of records requests between in the nested transactions',
    ifEquals('stub.iteration.TxRun.test_nested')
  ),
  skip(
    'Keeps retrying on commit despite connection being dropped',
    ifEquals('stub.retry.TestRetry.test_disconnect_on_commit')
  ),
  skip(
    'Wrong behaviour treating exceptions',
    ifEquals('test_client_exception_rolls_back_change')
  )
]

export function shouldRunTest (testName, { onRun, onSkip }) {
  const { reason } =
    skippedTests.find(({ predicate }) => predicate(testName)) || {}
  !reason ? onRun() : onSkip(reason)
}
