import skip, { ifEndsWith, ifStartsWith } from './skip.js'

const skippedTests = [
  skip('DenoJS fail hard on certificate error',
    ifEndsWith('test_trusted_ca_expired_server_correct_hostname'),
    ifEndsWith('test_trusted_ca_wrong_hostname'),
    ifEndsWith('test_unencrypted'),
    ifEndsWith('test_untrusted_ca_correct_hostname'),
    ifEndsWith('test_1_1'),
  ),
  skip('Trust All is no available as configuration',
    ifStartsWith('tls.test_self_signed_scheme.TestTrustAllCertsConfig.'),
    ifStartsWith('tls.test_self_signed_scheme.TestSelfSignedScheme.')
  )
]

export default skippedTests
