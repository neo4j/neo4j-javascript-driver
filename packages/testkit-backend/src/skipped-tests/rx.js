import { skip, ifEquals } from './skip'

const skippedTests = [
  skip(
    'Throws after run insted of the first next because of the backend implementation',
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_disconnect_on_tx_begin')
  )
]

export default skippedTests
