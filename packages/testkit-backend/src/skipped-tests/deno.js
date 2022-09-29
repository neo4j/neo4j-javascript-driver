import skip, { ifEndsWith, ifStartsWith, ifEquals } from './skip.js'

const skippedTests = [
  skip('DenoJS fail hard on certificate error',
    ifEndsWith('test_trusted_ca_expired_server_correct_hostname'),
    ifEndsWith('test_trusted_ca_wrong_hostname'),
    ifEndsWith('test_unencrypted'),
    ifEndsWith('test_untrusted_ca_correct_hostname'),
    ifEndsWith('test_1_1')
  ),
  skip('Trust All is no available as configuration',
    ifStartsWith('tls.test_self_signed_scheme.TestTrustAllCertsConfig.'),
    ifStartsWith('tls.test_self_signed_scheme.TestSelfSignedScheme.')
  ),
  skip('Takes a bit longer to complete in TeamCity',
    ifEquals('neo4j.test_session_run.TestSessionRun.test_long_string'),
    ifEquals('stub.driver_parameters.test_connection_acquisition_timeout_ms.TestConnectionAcquisitionTimeoutMs.test_should_fail_when_connection_timeout_is_reached_first)')
  )
]

export default skippedTests
