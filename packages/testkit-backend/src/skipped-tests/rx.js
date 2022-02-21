import { skip, ifEndsWith, ifEquals } from './skip'

const skippedTests = [
  skip(
    'Blowing the backends up',
    ifEndsWith('test_should_fail_when_writing_on_unexpectedly_interrupting_writer_using_session_run'),
    ifEndsWith('test_should_fail_when_writing_on_unexpectedly_interrupting_writer_using_tx_run'),
    ifEndsWith('test_should_fail_when_reading_from_unexpectedly_interrupting_reader_using_tx_run')
  ),
  skip(
    'Throws after run insted of the first next because of the backend implementation',
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_disconnect_on_tx_begin')
  )
]

export default skippedTests
