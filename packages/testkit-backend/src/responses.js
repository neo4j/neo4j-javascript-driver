import {
  nativeToTestkitSummary
} from './summary-binder.js'

export function Driver ({ id }) {
  return response('Driver', { id })
}

export function ResolverResolutionRequired ({ id, address }) {
  return response('ResolverResolutionRequired', { id, address })
}

export function BookmarkManager ({ id }) {
  return response('BookmarkManager', { id })
}

export function BookmarksSupplierRequest ({ id, bookmarkManagerId, database }) {
  return response('BookmarksSupplierRequest', { id, bookmarkManagerId, database })
}

export function BookmarksConsumerRequest ({ id, bookmarkManagerId, database, bookmarks }) {
  return response('BookmarksConsumerRequest', { id, bookmarkManagerId, database, bookmarks })
}

export function Session ({ id }) {
  return response('Session', { id })
}

export function Transaction ({ id }) {
  return response('Transaction', { id })
}

export function RetryableTry ({ id }) {
  return response('RetryableTry', { id })
}

export function RetryableDone () {
  return response('RetryableDone', null)
}

export function Result ({ id }) {
  return response('Result', { id })
}

export function NullRecord () {
  return response('NullRecord', null)
}

export function Record ({ record }, { binder }) {
  const values = Array.from(record.values()).map(binder.nativeToCypher)
  return response('Record', { values })
}

export function RecordList ({ records }, { binder }) {
  const cypherRecords = records.map(rec => {
    return { values: Array.from(rec.values()).map(binder.nativeToCypher) }
  })
  return response('RecordList', { records: cypherRecords })
}

export function Summary ({ summary }, { binder }) {
  return response('Summary', nativeToTestkitSummary(summary, binder))
}

export function Bookmarks ({ bookmarks }) {
  return response('Bookmarks', { bookmarks })
}

export function ServerInfo ({ serverInfo }) {
  return response('ServerInfo', {
    ...serverInfo,
    protocolVersion: serverInfo.protocolVersion.toFixed(1)
  })
}

export function MultiDBSupport ({ id, available }) {
  return response('MultiDBSupport', { id, available })
}

export function RoutingTable ({ routingTable }) {
  const serverAddressToString = serverAddress => serverAddress.asHostPort()
  return response('RoutingTable', {
    database: routingTable.database,
    ttl: Number(routingTable.ttl),
    readers: routingTable.readers.map(serverAddressToString),
    writers: routingTable.writers.map(serverAddressToString),
    routers: routingTable.routers.map(serverAddressToString)
  })
}

export function EagerResult ({ keys, records, summary }, { binder }) {
  const cypherRecords = records.map(rec => {
    return { values: Array.from(rec.values()).map(binder.nativeToCypher) }
  })
  return response('EagerResult', {
    keys,
    summary: nativeToTestkitSummary(summary, binder),
    records: cypherRecords
  })
}

export function AuthTokenProvider ({ id }) {
  return response('AuthTokenProvider', { id })
}

export function AuthTokenProviderRequest ({ id, authTokenProviderId }) {
  return response('AuthTokenProviderRequest', { id, authTokenProviderId })
}

// Testkit controller messages
export function RunTest () {
  return response('RunTest', null)
}

export function RunSubTests () {
  return response('RunSubTests', null)
}

export function SkipTest ({ reason }) {
  return response('SkipTest', { reason })
}

export function FeatureList ({ features }) {
  return response('FeatureList', { features })
}

export function FakeTimeAck () {
  return response('FakeTimeAck', {})
}

function response (name, data) {
  return { name, data }
}
