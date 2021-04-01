function ifEndsWith (suffix) {
  return testName => testName.endsWith(suffix)
}

function skip (reason, predicate) {
  return { reason, predicate }
}

const skippedTests = [
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
  )
]

export function shouldRunTest (testName, { onRun, onSkip }) {
  const { reason } =
    skippedTests.find(({ predicate }) => predicate(testName)) || {}
  !reason ? onRun() : onSkip(reason)
}
