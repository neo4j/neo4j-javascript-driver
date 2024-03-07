import skip, { ifEndsWith, ifStartsWith, ifEquals } from './skip.js'

const skippedTests = [
  skip('DenoJS fails hard on certificate error',
    ifEndsWith('test_trusted_ca_expired_server_correct_hostname'),
    ifEndsWith('test_trusted_ca_wrong_hostname'),
    ifEndsWith('test_unencrypted'),
    ifEndsWith('test_untrusted_ca_correct_hostname'),
    ifEndsWith('test_1_1')
  ),
  skip('DenoJS does not support client certificates',
    ifStartsWith('tls.test_client_certificate.')
  ),
  skip('Trust All is not available as configuration',
    ifStartsWith('tls.test_self_signed_scheme.TestTrustAllCertsConfig.'),
    ifStartsWith('tls.test_self_signed_scheme.TestSelfSignedScheme.')
  ),
  skip('Takes a bit longer to complete in TeamCity',
    ifEquals('neo4j.test_session_run.TestSessionRun.test_long_string')
  )
]

export default skippedTests
