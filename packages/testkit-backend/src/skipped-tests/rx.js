import { skip, ifEquals, ifStartsWith } from './skip.js'

const skippedTests = [
  skip(
    'Throws after run insted of the first next because of the backend implementation',
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_disconnect_on_tx_begin')
  ),
  skip(
    'Reactive driver does not send DISCARD on consume if records stream has been subscribed to',
    ifStartsWith('stub.summary.test_summary')
  )
]

export default skippedTests
