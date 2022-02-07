import neo4j from './neo4j'
import {
  cypherToNative,
  nativeToCypher,
} from './cypher-native-binders.js'
import {
  nativeToTestkitSummary,
} from './summary-binder.js'
import tls from 'tls'

const SUPPORTED_TLS = (() => {
  if (tls.DEFAULT_MAX_VERSION) {
    const min = Number(tls.DEFAULT_MIN_VERSION.split('TLSv')[1])
    const max = Number(tls.DEFAULT_MAX_VERSION.split('TLSv')[1])
    const result = [];
    for (let version = min > 1 ? min : 1.1; version <= max; version = Number((version + 0.1).toFixed(1)) ) {
      result.push(`Feature:TLS:${version.toFixed(1)}`)
    }
    return result;
  }
  return [];
})();

export function throwFrontendError() {
  throw new Error("TestKit FrontendError")
}

export function isFrontendError(error) {
  return error.message === 'TestKit FrontendError'
}

export function NewDriver (context, data, wire) {
  const {
    uri,
    authorizationToken: { data: authToken },
    userAgent,
    resolverRegistered
  } = data
  let parsedAuthToken = authToken
  switch (authToken.scheme) {
    case 'basic':
      parsedAuthToken = neo4j.auth.basic(
        authToken.principal,
        authToken.credentials,
        authToken.realm
      )
      break
    case 'kerberos':
      parsedAuthToken = neo4j.auth.kerberos(authToken.credentials)
      break
    case 'bearer':
      parsedAuthToken = neo4j.auth.bearer(authToken.credentials)
    default:
      parsedAuthToken = neo4j.auth.custom(
        authToken.principal,
        authToken.credentials,
        authToken.realm,
        authToken.scheme,
        authToken.parameters
      )
  }
  const resolver = resolverRegistered
    ? address =>
      new Promise((resolve, reject) => {
        const id = context.addResolverRequest(resolve, reject)
        wire.writeResponse('ResolverResolutionRequired', { id, address })
      })
    : undefined
  const config = {
    userAgent,
    resolver,
    useBigInt: true,
    logging: neo4j.logging.console(process.env.LOG_LEVEL)
  }
  if ('encrypted' in data) {
    config.encrypted = data.encrypted ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF'
  }
  if ('trustedCertificates' in data) {
    if (data.trustedCertificates === null) {
      config.trust = 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
    } else if (data.trustedCertificates.length === 0) {
      config.trust = 'TRUST_ALL_CERTIFICATES'
    } else {
      config.trust = 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES'
      config.trustedCertificates = data.trustedCertificates.map(
        e => '/usr/local/share/custom-ca-certificates/' + e
      )
    }
  }
  if ('maxConnectionPoolSize' in data) {
    config.maxConnectionPoolSize = data.maxConnectionPoolSize
  }
  if ('connectionAcquisitionTimeoutMs' in data) {
    config.connectionAcquisitionTimeout = data.connectionAcquisitionTimeoutMs
  }
  if ('fetchSize' in data) {
    config.fetchSize = data.fetchSize
  }
  let driver
  try {
    driver = neo4j.driver(uri, parsedAuthToken, config)
  } catch (err) {
    wire.writeError(err)
    return
  }
  const id = context.addDriver(driver)
  wire.writeResponse('Driver', { id })
}

export function DriverClose (context, data, wire) {
  const { driverId } = data
  const driver = context.getDriver(driverId)
  return driver
    .close()
    .then(() => {
      wire.writeResponse('Driver', { id: driverId })
    })
    .catch(err => wire.writeError(err))
}

export function NewSession (context, data, wire) {
  let { driverId, accessMode, bookmarks, database, fetchSize, impersonatedUser } = data
  switch (accessMode) {
    case 'r':
      accessMode = neo4j.session.READ
      break
    case 'w':
      accessMode = neo4j.session.WRITE
      break
    default:
      wire.writeBackendError('Unknown accessmode: ' + accessMode)
      return
  }
  const driver = context.getDriver(driverId)
  const session = driver.session({
    defaultAccessMode: accessMode,
    bookmarks,
    database,
    fetchSize,
    impersonatedUser
  })
  const id = context.addSession(session)
  wire.writeResponse('Session', { id })
}

export function SessionClose (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  return session
    .close()
    .then(() => {
      wire.writeResponse('Session', { id: sessionId })
    })
    .catch(err => wire.writeError(err))
}

export function SessionRun (context, data, wire) {
  const { sessionId, cypher, params, txMeta: metadata, timeout } = data
  const session = context.getSession(sessionId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      params[key] = cypherToNative(value)
    }
  }

  let result
  try {
    result = session.run(cypher, params, { metadata, timeout })
  } catch (e) {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
    return
  }

  let id = context.addResult(result)

  wire.writeResponse('Result', { id })
}

export function ResultNext (context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)
  if (!("recordIt" in result)) {
    result.recordIt = result[Symbol.asyncIterator]()
  }
  return result.recordIt.next().then(({ value, done }) => {
    if (done) {
      wire.writeResponse('NullRecord', null)
    } else {
      const values = Array.from(value.values()).map(nativeToCypher)
      wire.writeResponse('Record', {
        values: values
      })
    }
  }).catch(e => {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
  });
}

export function ResultPeek (context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)
  if (!("recordIt" in result)) {
    result.recordIt = result[Symbol.asyncIterator]()
  }
  return result.recordIt.peek().then(({ value, done }) => {
    if (done) {
      wire.writeResponse('NullRecord', null)
    } else {
      const values = Array.from(value.values()).map(nativeToCypher)
      wire.writeResponse('Record', {
        values: values
      })
    }
  }).catch(e => {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
  });
}

export function ResultConsume (context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)

  return result.summary().then(summary => {
    wire.writeResponse('Summary', nativeToTestkitSummary(summary))
  }).catch(e => wire.writeError(e))
}

export function ResultList (context, data, wire) {
  const { resultId } = data

  const result = context.getResult(resultId)

  return result
    .then(({ records }) => {
      const cypherRecords = records.map(rec => {
        return { values: Array.from(rec.values()).map(nativeToCypher) }
      })
      wire.writeResponse('RecordList', { records: cypherRecords})
    })
    .catch(error => wire.writeError(error))
}

export function SessionReadTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  return session
    .readTransaction(
      tx =>
        new Promise((resolve, reject) => {
          const id = context.addTx(tx, sessionId, resolve, reject)
          wire.writeResponse('RetryableTry', { id })
        })
    , { metadata })
    .then(_ => wire.writeResponse('RetryableDone', null))
    .catch(error => wire.writeError(error))
}

export function TransactionRun (context, data, wire) {
  const { txId, cypher, params } = data
  const tx = context.getTx(txId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      params[key] = cypherToNative(value)
    }
  }
  const result = tx.tx.run(cypher, params)
  const id = context.addResult(result)

  wire.writeResponse('Result', { id })
}

export function RetryablePositive (context, data, wire) {
  const { sessionId } = data
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.resolve()
  })
}

export function RetryableNegative (context, data, wire) {
  const { sessionId, errorId } = data
  const error = context.getError(errorId) || new Error('TestKit FrontendError')
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.reject(error)
  })
}

export function SessionBeginTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata, timeout } = data
  const session = context.getSession(sessionId)
  let tx
  try {
    tx = session.beginTransaction({ metadata, timeout })
  } catch (e) {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
    return
  }
  const id = context.addTx(tx, sessionId)
  wire.writeResponse('Transaction', { id })
}

export function TransactionCommit (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.commit()
    .then(() => wire.writeResponse('Transaction', { id }))
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function TransactionRollback (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.rollback()
    .then(() => wire.writeResponse('Transaction', { id }))
    .catch(e => wire.writeError(e))
}

export function TransactionClose (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.close()
    .then(() => wire.writeResponse('Transaction', { id }))
    .catch(e => wire.writeError(e))
}

export function SessionLastBookmarks (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const bookmarks = session.lastBookmarks()
  wire.writeResponse('Bookmarks', { bookmarks })
}

export function SessionWriteTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  return session
    .writeTransaction(
      tx =>
        new Promise((resolve, reject) => {
          const id = context.addTx(tx, sessionId, resolve, reject)
          wire.writeResponse('RetryableTry', { id })
        })
    , { metadata })
    .then(_ => wire.writeResponse('RetryableDone', null))
    .catch(error => wire.writeError(error))
}

export function StartTest (context, { testName }, wire) {
  const shouldRunTest = context.getShouldRunTestFunction()
  shouldRunTest(testName, {
    onRun: () => wire.writeResponse('RunTest', null),
    onSkip: reason => wire.writeResponse('SkipTest', { reason })
  })
}

export function GetFeatures (_context, _params, wire) {
  wire.writeResponse('FeatureList', {
    features: [
      'Feature:Auth:Custom',
      'Feature:Auth:Kerberos',
      'Feature:Auth:Bearer',
      'Feature:API:SSLConfig',
      'Feature:API:SSLSchemes',
      'AuthorizationExpiredTreatment',
      'ConfHint:connection.recv_timeout_seconds',
      'Feature:Impersonation',
      'Feature:Bolt:3.0',
      'Feature:Bolt:4.1',
      'Feature:Bolt:4.2',
      'Feature:Bolt:4.3',
      'Feature:Bolt:4.4',
      'Feature:API:Result.List',
      'Feature:API:Result.Peek',
      'Temporary:ConnectionAcquisitionTimeout',
      'Temporary:CypherPathAndRelationship',
      'Temporary:DriverFetchSize',
      'Temporary:DriverMaxConnectionPoolSize',
      'Temporary:DriverMaxTxRetryTime',
      'Temporary:GetConnectionPoolMetrics',
      'Temporary:FastFailingDiscovery',
      'Temporary:FullSummary',
      'Temporary:ResultKeys',
      'Temporary:TransactionClose',
      ...SUPPORTED_TLS
    ]
  })
}

export function VerifyConnectivity (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .verifyConnectivity()
    .then(() => wire.writeResponse('Driver', { id: driverId }))
    .catch(error => wire.writeError(error))
}

export function CheckMultiDBSupport (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .supportsMultiDb()
    .then(available =>
      wire.writeResponse('MultiDBSupport', { id: driverId, available })
    )
    .catch(error => wire.writeError(error))
}

export function ResolverResolutionCompleted (
  context,
  { requestId, addresses },
  wire
) {
  const request = context.getResolverRequest(requestId)
  request.resolve(addresses)
}

export function GetRoutingTable (context, { driverId, database }, wire) {
  const serverAddressToString = serverAddress => serverAddress.asHostPort()
  const driver = context.getDriver(driverId)
  const routingTable =
    driver &&
    driver._getOrCreateConnectionProvider() &&
    driver._getOrCreateConnectionProvider()._routingTableRegistry &&
    driver._getOrCreateConnectionProvider()._routingTableRegistry.get(database, () => {
      return {
        database,
        ttl: 0,
        readers: [],
        writers: [],
        routers: []
      }
    })

  if (routingTable) {
    wire.writeResponse('RoutingTable', {
      database: routingTable.database,
      ttl: Number(routingTable.ttl),
      readers: routingTable.readers.map(serverAddressToString),
      writers: routingTable.writers.map(serverAddressToString),
      routers: routingTable.routers.map(serverAddressToString)
    })
  } else {
    wire.writeError('Driver does not support routing')
  }
}

export function ForcedRoutingTableUpdate (context, { driverId, database, bookmarks }, wire) {
  const driver = context.getDriver(driverId)
  const provider = driver._getOrCreateConnectionProvider()

  if (provider._freshRoutingTable) {
    // Removing database from the routing table registry
    provider._routingTableRegistry._remove(database)
    return provider._freshRoutingTable ({
        accessMode: 'READ',
        database,
        bookmarks: bookmarks,
        onDatabaseNameResolved: () => {}
    })
      .then(() => wire.writeResponse("Driver", { "id": driverId }))
      .catch(error => wire.writeError(error))
  } else {
    wire.writeError('Driver does not support routing')
  }
}
