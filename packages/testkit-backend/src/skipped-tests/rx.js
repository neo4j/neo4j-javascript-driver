import { skip, ifEndsWith } from './skip'

const skippedTests = [
  skip(
    'Blowing the backends up',
    ifEndsWith('test_should_fail_when_writing_on_unexpectedly_interrupting_writer_using_session_run'),
    ifEndsWith('test_should_fail_when_writing_on_unexpectedly_interrupting_writer_using_tx_run')
  )
]

export default skippedTests
