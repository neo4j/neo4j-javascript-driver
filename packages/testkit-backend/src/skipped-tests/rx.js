import { skip, ifEquals } from './skip'

const skippedTests = [
  skip(
    'Throws after run insted of the first next because of the backend implementation',
    ifEquals('stub.disconnects.test_disconnects.TestDisconnects.test_disconnect_on_tx_begin')
  ),
  skip(
    'Backend could not support this test',
    ifEquals('stub.types.test_temporal_types.TestTemporalTypesV4x4.test_unknown_zoned_date_time'),
    ifEquals('stub.types.test_temporal_types.TestTemporalTypesV4x4.test_unknown_zoned_date_time_patched'),
    ifEquals('stub.types.test_temporal_types.TestTemporalTypesV4x4.test_unknown_then_known_zoned_date_time'),
    ifEquals('stub.types.test_temporal_types.TestTemporalTypesV4x4.test_unknown_then_known_zoned_date_time_patched'),
    ifEquals('stub.types.test_temporal_types.TestTemporalTypesV5x0.test_unknown_then_known_zoned_date_time'),
    ifEquals('stub.types.test_temporal_types.TestTemporalTypesV5x0.test_unknown_zoned_date_time')
  )
]

export default skippedTests
