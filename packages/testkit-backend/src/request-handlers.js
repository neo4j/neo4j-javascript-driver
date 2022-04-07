import neo4j from './neo4j'
import { cypherToNative } from './cypher-native-binders.js'
import  * as responses from './responses.js'

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
        wire.writeResponse(responses.ResolverResolutionRequired({ id, address }))
      })
    : undefined
  const config = {
    userAgent,
    resolver,
    useBigInt: true,
    logging: neo4j.logging.console(process.env.LOG_LEVEL || context.logLevel)
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
  if ('connectionTimeoutMs' in data) {
    config.connectionTimeout = data.connectionTimeoutMs
  }
  if ('fetchSize' in data) {
    config.fetchSize = data.fetchSize
  }
  if ('maxTxRetryTimeMs' in data) {
    config.maxTransactionRetryTime = data.maxTxRetryTimeMs
  }
  let driver
  try {
    driver = neo4j.driver(uri, parsedAuthToken, config)
  } catch (err) {
    wire.writeError(err)
    return
  }
  const id = context.addDriver(driver)
  wire.writeResponse(responses.Driver({ id }))
}

export function DriverClose (context, data, wire) {
  const { driverId } = data
  const driver = context.getDriver(driverId)
  return driver
    .close()
    .then(() => {
      wire.writeResponse(responses.Driver({ id: driverId }))
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
  wire.writeResponse(responses.Session({ id }))
}

export function SessionClose (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  return session
    .close()
    .then(() => {
      wire.writeResponse(responses.Session({ id: sessionId }))
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

  wire.writeResponse(responses.Result({ id }))
}

export function ResultNext (context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)
  if (!("recordIt" in result)) {
    result.recordIt = result[Symbol.asyncIterator]()
  }
  return result.recordIt.next().then(({ value, done }) => {
    if (done) {
      wire.writeResponse(responses.NullRecord())
    } else {
      wire.writeResponse(responses.Record({ record: value }))
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
      wire.writeResponse(responses.NullRecord())
    } else {
      wire.writeResponse(responses.Record({ record: value }))
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
    wire.writeResponse(responses.Summary({ summary }))
  }).catch(e => wire.writeError(e))
}

export function ResultList (context, data, wire) {
  const { resultId } = data

  const result = context.getResult(resultId)

  return result
    .then(({ records }) => {
      wire.writeResponse(responses.RecordList({ records }))
    })
    .catch(error => wire.writeError(error))
}

export function SessionReadTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  return session
    .executeRead(
      tx =>
        new Promise((resolve, reject) => {
          const id = context.addTx(tx, sessionId, resolve, reject)
          wire.writeResponse(responses.RetryableTry({ id }))
        })
    , { metadata })
    .then(_ => wire.writeResponse(responses.RetryableDone()))
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

  wire.writeResponse(responses.Result({ id }))
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

  try {
    return session.beginTransaction({ metadata, timeout })
    .then(tx => {
      const id = context.addTx(tx, sessionId)
      wire.writeResponse(responses.Transaction({ id }))
    }).catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
  } catch (e) {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
    return
  }
}

export function TransactionCommit (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.commit()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function TransactionRollback (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.rollback()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => wire.writeError(e))
}

export function TransactionClose (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.close()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => wire.writeError(e))
}

export function SessionLastBookmarks (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const bookmarks = session.lastBookmarks()
  wire.writeResponse(responses.Bookmarks({ bookmarks }))
}

export function SessionWriteTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  return session
    .executeWrite(
      tx =>
        new Promise((resolve, reject) => {
          const id = context.addTx(tx, sessionId, resolve, reject)
          wire.writeResponse(responses.RetryableTry({ id }))
        })
    , { metadata })
    .then(_ => wire.writeResponse(responses.RetryableDone()))
    .catch(error => wire.writeError(error))
}

export function StartTest (context, { testName }, wire) {
  if (testName.endsWith('.test_disconnect_session_on_tx_pull_after_record')) {
    context.logLevel = 'debug'
  } else {
    context.logLevel = null
  }
  const shouldRunTest = context.getShouldRunTestFunction()
  shouldRunTest(testName, {
    onRun: () => wire.writeResponse(responses.RunTest()),
    onSkip: reason => wire.writeResponse(responses.SkipTest({ reason }))
  })
}

export function GetFeatures (context, _params, wire) {
  wire.writeResponse(responses.FeatureList({
    features: context.getFeatures()
  }))
}

export function VerifyConnectivity (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .verifyConnectivity()
    .then(() => wire.writeResponse(responses.Driver({ id: driverId })))
    .catch(error => wire.writeError(error))
}

export function GetServerInfo (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .getServerInfo()
    .then(serverInfo => wire.writeResponse(responses.ServerInfo({ serverInfo })))
    .catch(error => wire.writeError(error))
}

export function CheckMultiDBSupport (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .supportsMultiDb()
    .then(available =>
      wire.writeResponse(responses.MultiDBSupport({ id: driverId, available }))
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
    wire.writeResponse(responses.RoutingTable({ routingTable }))
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
      .then(() => wire.writeResponse(responses.Driver({ "id": driverId })))
      .catch(error => wire.writeError(error))
  } else {
    wire.writeError('Driver does not support routing')
  }
}
