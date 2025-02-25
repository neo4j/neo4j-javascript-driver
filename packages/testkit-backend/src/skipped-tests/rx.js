import { skip, ifEquals, ifStartsWith } from './skip.js'

const skippedTests = [
  skip(
    'Throws after run insted of the first next because of the backend implementation',
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_disconnect_on_tx_begin')
  ),
  skip(
    'Reactive driver does not send DISCARD on consume if records stream has been subscribed to',
    ifStartsWith('stub.summary.test_summary.TestSummaryPlanDiscard'),
    ifStartsWith('stub.summary.test_summary.TestSummaryCountersDiscard'),
    ifStartsWith('stub.summary.test_summary.TestSummaryBasicInfoDiscard'),
    ifStartsWith('stub.summary.test_summary.TestSummaryGqlStatusObjects4x4Discard'),
    ifStartsWith('stub.summary.test_summary.TestSummaryGqlStatusObjects5x6Discard'),
    ifStartsWith('stub.summary.test_summary.TestSummaryNotifications4x4Discard'),
    ifStartsWith('stub.summary.test_summary.TestSummaryNotifications5x6Discard')
  )
]

export default skippedTests
