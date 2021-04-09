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

function skip (reason, ...predicate) {
  return { reason, predicate: or(...predicate) }
}

const skippedTests = [
  skip(
    'The driver has no support domain_name_resolver',
    ifEndsWith('test_should_successfully_acquire_rt_when_router_ip_changes'),
    ifEndsWith(
      'test_should_request_rt_from_all_initial_routers_until_successful'
    )
  ),
  skip(
    'Driver is start to run tx_function before have a valid connection in hands',
    ifEndsWith(
      'test_should_retry_write_until_success_with_leader_shutdown_during_tx_using_tx_function'
    ),
    ifEndsWith(
      'test_should_retry_write_until_success_with_leader_change_using_tx_function'
    )
  ),
  skip(
    'Driver is creating a dedicated connection to check the MultiDBSupport',
    ifEndsWith(
      'test_should_successfully_check_if_support_for_multi_db_is_available'
    )
  ),
  skip(
    'Fails when runned with the full suite',
    ifEndsWith(
      '.test_should_revert_to_initial_router_if_known_router_throws_protocol_errors'
    )
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
    'Wait clarification about verifyConnectivity behaviour when no reader connection is available',
    ifEndsWith(
      '.test_should_use_initial_router_for_discovery_when_others_unavailable'
    ),
    ifEndsWith('.test_should_successfully_get_routing_table_with_context')
  )
]

export function shouldRunTest (testName, { onRun, onSkip }) {
  const { reason } =
    skippedTests.find(({ predicate }) => predicate(testName)) || {}
  !reason ? onRun() : onSkip(reason)
}
