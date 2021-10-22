import neo4j from './neo4j'
import ResultObserver from './result-observer.js'
import { cypherToNative, nativeToCypher } from './cypher-native-binders.js'
import { shouldRunTest } from './skipped-tests'

export function NewDriver (context, data, { writeResponse }) {
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
        writeResponse('ResolverResolutionRequired', { id, address })
      })
    : undefined
  const driver = neo4j.driver(uri, parsedAuthToken, {
    userAgent,
    resolver,
    useBigInt: true,
    logging: neo4j.logging.console(process.env.LOG_LEVEL)
  })
  const id = context.addDriver(driver)
  writeResponse('Driver', { id })
}

export function DriverClose (context, data, wire) {
  const { driverId } = data
  const driver = context.getDriver(driverId)
  driver
    .close()
    .then(() => {
      wire.writeResponse('Driver', { id: driverId })
    })
    .catch(err => wire.writeError(err))
  context.removeDriver(driverId)
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
  session
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

  const observers = context.getResultObserversBySessionId(sessionId)

  Promise.all(observers.map(obs => obs.completitionPromise()))
    .catch(_ => null)
    .then(_ => {
      const result = session.run(cypher, params, { metadata, timeout })
      const resultObserver = new ResultObserver({ sessionId, result })
      result.subscribe(resultObserver)
      const id = context.addResultObserver(resultObserver)
      wire.writeResponse('Result', { id })
    })
}

export function ResultNext (context, data, wire) {
  const { resultId } = data
  const resultObserver = context.getResultObserver(resultId)
  const nextPromise = resultObserver.next()
  nextPromise
    .then(rec => {
      if (rec) {
        const values = Array.from(rec.values()).map(nativeToCypher)
        wire.writeResponse('Record', {
          values: values
        })
      } else {
        wire.writeResponse('NullRecord', null)
      }
    })
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function ResultConsume (context, data, wire) {
  const { resultId } = data
  const resultObserver = context.getResultObserver(resultId)
  resultObserver
    .completitionPromise()
    .then(summary => {
      wire.writeResponse('Summary', {
        ...summary,
        serverInfo: {
          agent: summary.server.agent,
          protocolVersion: summary.server.protocolVersion.toFixed(1)
        }
      })
    })
    .catch(e => wire.writeError(e))
}

export function SessionReadTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  session
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
  const resultObserver = new ResultObserver({ result })
  result.subscribe(resultObserver)
  const id = context.addResultObserver(resultObserver)
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
  const error = context.getError(errorId) || new Error('Client error')
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.reject(error)
  })
}

export function SessionBeginTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata, timeout } = data
  const session = context.getSession(sessionId)
  const tx = session.beginTransaction({ metadata, timeout })
  const id = context.addTx(tx, sessionId)
  wire.writeResponse('Transaction', { id })
}

export function TransactionCommit (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  tx.commit()
    .then(() => wire.writeResponse('Transaction', { id }))
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function TransactionRollback (context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  tx.rollback()
    .then(() => wire.writeResponse('Transaction', { id }))
    .catch(e => wire.writeError(e))
}

export function SessionLastBookmarks (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const bookmarks = session.lastBookmark()
  wire.writeResponse('Bookmarks', { bookmarks })
}

export function SessionWriteTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  session
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

export function StartTest (_, { testName }, wire) {
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
      'AuthorizationExpiredTreatment',
      'ConfHint:connection.recv_timeout_seconds',
      'Feature:Bolt:4.4',
      'Feature:Impersonation'
    ]
  })
}

export function VerifyConnectivity (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  driver
    .verifyConnectivity()
    .then(() => wire.writeResponse('Driver', { id: driverId }))
    .catch(error => wire.writeError(error))
}

export function CheckMultiDBSupport (context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  driver
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
    provider._freshRoutingTable ({
        accessMode: 'READ',
        database,
        bookmark: bookmarks,
        onDatabaseNameResolved: () => {}
    })
      .then(() => wire.writeResponse("Driver", { "id": driverId }))
      .catch(error => wire.writeError(error))
  } else {
    wire.writeError('Driver does not support routing')
  }
}
