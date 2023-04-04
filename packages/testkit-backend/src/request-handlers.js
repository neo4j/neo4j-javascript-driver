import * as responses from './responses.js'

export function throwFrontendError () {
  throw new Error('TestKit FrontendError')
}

export function isFrontendError (error) {
  return error.message === 'TestKit FrontendError'
}

export function NewDriver ({ neo4j }, context, data, wire) {
  const {
    uri,
    authorizationToken,
    authTokenManagerId,
    userAgent,
    resolverRegistered
  } = data

  let parsedAuthToken = null

  if (authorizationToken != null && authTokenManagerId != null) {
    throw new Error('Can not set authorizationToken and authTokenManagerId')
  } else if (authorizationToken) {
    const { data: authToken } = authorizationToken
    parsedAuthToken = context.binder.parseAuthToken(authToken)
  } else {
    parsedAuthToken = context.getAuthTokenManager(authTokenManagerId)
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
    logging: neo4j.logging.console(context.logLevel || context.environmentLogLevel)
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
  if ('notificationsMinSeverity' in data || 'notificationsDisabledCategories' in data) {
    config.notificationFilter = {
      minimumSeverityLevel: data.notificationsMinSeverity,
      disabledCategories: data.notificationsDisabledCategories
    }
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

export function DriverClose (_, context, data, wire) {
  const { driverId } = data
  const driver = context.getDriver(driverId)
  return driver
    .close()
    .then(() => {
      wire.writeResponse(responses.Driver({ id: driverId }))
    })
    .catch(err => wire.writeError(err))
}

export function NewSession ({ neo4j }, context, data, wire) {
  let { driverId, accessMode, bookmarks, database, fetchSize, impersonatedUser, bookmarkManagerId } = data
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
  let bookmarkManager
  if (bookmarkManagerId != null) {
    bookmarkManager = context.getBookmarkManager(bookmarkManagerId)
    if (bookmarkManager == null) {
      wire.writeBackendError(`Bookmark manager ${bookmarkManagerId} not found`)
      return
    }
  }
  let notificationFilter
  if ('notificationsMinSeverity' in data || 'notificationsDisabledCategories' in data) {
    notificationFilter = {
      minimumSeverityLevel: data.notificationsMinSeverity,
      disabledCategories: data.notificationsDisabledCategories
    }
  }
  const auth = data.authorizationToken != null
    ? context.binder.parseAuthToken(data.authorizationToken.data)
    : undefined

  const driver = context.getDriver(driverId)
  const session = driver.session({
    defaultAccessMode: accessMode,
    bookmarks,
    database,
    fetchSize,
    impersonatedUser,
    bookmarkManager,
    notificationFilter,
    auth
  })
  const id = context.addSession(session)
  wire.writeResponse(responses.Session({ id }))
}

export function SessionClose (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  return session
    .close()
    .then(() => {
      wire.writeResponse(responses.Session({ id: sessionId }))
    })
    .catch(err => wire.writeError(err))
}

export function SessionRun (_, context, data, wire) {
  const { sessionId, cypher, timeout } = data
  const session = context.getSession(sessionId)
  const params = context.binder.objectToNative(data.params)
  const metadata = context.binder.objectToNative(data.txMeta)

  let result
  try {
    result = session.run(cypher, params, { metadata, timeout })
  } catch (e) {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
    return
  }

  const id = context.addResult(result)

  wire.writeResponse(responses.Result({ id }))
}

export function ResultNext (_, context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)
  if (!('recordIt' in result)) {
    result.recordIt = result[Symbol.asyncIterator]()
  }
  return result.recordIt.next().then(({ value, done }) => {
    if (done) {
      wire.writeResponse(responses.NullRecord())
    } else {
      wire.writeResponse(responses.Record({ record: value }, { binder: context.binder }))
    }
  }).catch(e => {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
  })
}

export function ResultPeek (_, context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)
  if (!('recordIt' in result)) {
    result.recordIt = result[Symbol.asyncIterator]()
  }
  return result.recordIt.peek().then(({ value, done }) => {
    if (done) {
      wire.writeResponse(responses.NullRecord())
    } else {
      wire.writeResponse(responses.Record({ record: value }, { binder: context.binder }))
    }
  }).catch(e => {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
  })
}

export function ResultConsume (_, context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)

  return result.summary().then(summary => {
    wire.writeResponse(responses.Summary({ summary }, { binder: context.binder }))
  }).catch(e => wire.writeError(e))
}

export function ResultList (_, context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)

  return result
    .then(({ records }) => {
      wire.writeResponse(responses.RecordList({ records }, { binder: context.binder }))
    })
    .catch(error => wire.writeError(error))
}

export function SessionReadTransaction (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const metadata = context.binder.objectToNative(data.txMeta)

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

export function TransactionRun (_, context, data, wire) {
  const { txId, cypher, params } = data
  const tx = context.getTx(txId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      params[key] = context.binder.cypherToNative(value)
    }
  }
  const result = tx.tx.run(cypher, params)
  const id = context.addResult(result)

  wire.writeResponse(responses.Result({ id }))
}

export function RetryablePositive (_, context, data, wire) {
  const { sessionId } = data
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.resolve()
  })
}

export function RetryableNegative (_, context, data, wire) {
  const { sessionId, errorId } = data
  const error = context.getError(errorId) || new Error('TestKit FrontendError')
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.reject(error)
  })
}

export function SessionBeginTransaction (_, context, data, wire) {
  const { sessionId, timeout } = data
  const session = context.getSession(sessionId)
  const metadata = context.binder.objectToNative(data.txMeta)

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
  }
}

export function TransactionCommit (_, context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.commit()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function TransactionRollback (_, context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.rollback()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => wire.writeError(e))
}

export function TransactionClose (_, context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.close()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => wire.writeError(e))
}

export function SessionLastBookmarks (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const bookmarks = session.lastBookmarks()
  wire.writeResponse(responses.Bookmarks({ bookmarks }))
}

export function SessionWriteTransaction (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const metadata = context.binder.objectToNative(data.txMeta)

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

export function StartTest (_, context, { testName }, wire) {
  if (testName.endsWith('.test_disconnect_session_on_tx_pull_after_record') || testName.endsWith('test_no_reset_on_clean_connection')) {
    context.logLevel = 'debug'
  } else {
    context.logLevel = null
  }
  const shouldRunTest = context.getShouldRunTestFunction()
  shouldRunTest(testName, {
    onRun: () => {
      if (testName === 'neo4j.datatypes.test_temporal_types.TestDataTypes.test_date_time_cypher_created_tz_id') {
        return wire.writeResponse(responses.RunSubTests())
      }
      return wire.writeResponse(responses.RunTest())
    },
    onSkip: reason => wire.writeResponse(responses.SkipTest({ reason }))
  })
}

export function StartSubTest (_, context, { testName, subtestArguments }, wire) {
  if (testName === 'neo4j.datatypes.test_temporal_types.TestDataTypes.test_date_time_cypher_created_tz_id') {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: subtestArguments.tz_id })
      return wire.writeResponse(responses.RunTest())
    } catch (e) {
      wire.writeResponse(responses.SkipTest({ reason: `Unsupported tzid: ${subtestArguments.tz_id}` }))
    }
  } else {
    wire.writeBackendError(`No entry for ${testName} in StartSubTest`)
  }
}

export function GetFeatures (_, context, _params, wire) {
  wire.writeResponse(responses.FeatureList({
    features: context.getFeatures()
  }))
}

export function VerifyConnectivity (_, context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .verifyConnectivity()
    .then(() => wire.writeResponse(responses.Driver({ id: driverId })))
    .catch(error => wire.writeError(error))
}

export function VerifyAuthentication (_, context, { driverId, auth_token: authToken }, wire) {
  const auth = authToken != null && authToken.data != null
    ? context.binder.parseAuthToken(authToken.data)
    : undefined

  const driver = context.getDriver(driverId)
  return driver
    .verifyAuthentication({ auth })
    .then(authenticated => wire.writeResponse(responses.DriverIsAuthenticated({ id: driverId, authenticated })))
    .catch(error => wire.writeError(error))
}

export function GetServerInfo (_, context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .getServerInfo()
    .then(serverInfo => wire.writeResponse(responses.ServerInfo({ serverInfo })))
    .catch(error => wire.writeError(error))
}

export function CheckMultiDBSupport (_, context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .supportsMultiDb()
    .then(available =>
      wire.writeResponse(responses.MultiDBSupport({ id: driverId, available }))
    )
    .catch(error => wire.writeError(error))
}

export function CheckSessionAuthSupport (_, context, { driverId }, wire) {
  const driver = context.getDriver(driverId)
  return driver
    .supportsSessionAuth()
    .then(available =>
      wire.writeResponse(responses.SessionAuthSupport({ id: driverId, available }))
    )
    .catch(error => wire.writeError(error))
}

export function ResolverResolutionCompleted (
  _,
  context,
  { requestId, addresses },
  wire
) {
  const request = context.getResolverRequest(requestId)
  request.resolve(addresses)
}

export function NewBookmarkManager (
  { neo4j },
  context,
  {
    initialBookmarks,
    bookmarksSupplierRegistered,
    bookmarksConsumerRegistered
  },
  wire
) {
  let bookmarkManager
  const id = context.addBookmarkManager((bookmarkManagerId) => {
    let bookmarksSupplier
    let bookmarksConsumer
    if (bookmarksSupplierRegistered === true) {
      bookmarksSupplier = () =>
        new Promise((resolve, reject) => {
          const id = context.addBookmarkSupplierRequest(resolve, reject)
          wire.writeResponse(responses.BookmarksSupplierRequest({ id, bookmarkManagerId }))
        })
    }
    if (bookmarksConsumerRegistered === true) {
      bookmarksConsumer = (bookmarks) =>
        new Promise((resolve, reject) => {
          const id = context.addNotifyBookmarksRequest(resolve, reject)
          wire.writeResponse(responses.BookmarksConsumerRequest({ id, bookmarkManagerId, bookmarks }))
        })
    }
    bookmarkManager = neo4j.bookmarkManager({
      initialBookmarks,
      bookmarksConsumer,
      bookmarksSupplier
    })

    return bookmarkManager
  })

  wire.writeResponse(responses.BookmarkManager({ id }))
}

export function BookmarkManagerClose (
  _,
  context,
  {
    id
  },
  wire
) {
  context.removeBookmarkManager(id)
  wire.writeResponse(responses.BookmarkManager({ id }))
}

export function BookmarksSupplierCompleted (
  _,
  context,
  {
    requestId,
    bookmarks
  }
) {
  const bookmarkSupplierRequest = context.getBookmarkSupplierRequest(requestId)
  bookmarkSupplierRequest.resolve(bookmarks)
}

export function BookmarksConsumerCompleted (
  _,
  context,
  {
    requestId
  }
) {
  const notifyBookmarksRequest = context.getNotifyBookmarksRequest(requestId)
  notifyBookmarksRequest.resolve()
}

export function NewAuthTokenManager (_, context, _data, wire) {
  const id = context.addAuthTokenManager((authTokenManagerId) => {
    return {
      getToken: () => new Promise((resolve, reject) => {
        const id = context.addAuthTokenManagerGetAuthRequest(resolve, reject)
        wire.writeResponse(responses.AuthTokenManagerGetAuthRequest({ id, authTokenManagerId }))
      }),
      onTokenExpired: (auth) => {
        const id = context.addAuthTokenManagerOnAuthExpiredRequest()
        wire.writeResponse(responses.AuthTokenManagerOnAuthExpiredRequest({ id, authTokenManagerId, auth }))
      }
    }
  })

  wire.writeResponse(responses.AuthTokenManager({ id }))
}

export function AuthTokenManagerClose (_, context, { id }, wire) {
  context.removeAuthTokenManager(id)
  wire.writeResponse(responses.AuthTokenManager({ id }))
}

export function AuthTokenManagerGetAuthCompleted (_, context, { requestId, auth }) {
  const request = context.getAuthTokenManagerGetAuthRequest(requestId)
  request.resolve(auth.data)
  context.removeAuthTokenManagerGetAuthRequest(requestId)
}

export function AuthTokenManagerOnAuthExpiredCompleted (_, context, { requestId }) {
  context.removeAuthTokenManagerOnAuthExpiredRequest(requestId)
}

export function NewExpirationBasedAuthTokenManager ({ neo4j }, context, _, wire) {
  const id = context.addAuthTokenManager((expirationBasedAuthTokenManagerId) => {
    return neo4j.expirationBasedAuthTokenManager({
      tokenProvider: () => new Promise((resolve, reject) => {
        const id = context.addExpirationBasedAuthTokenProviderRequest(resolve, reject)
        wire.writeResponse(responses.ExpirationBasedAuthTokenProviderRequest({ id, expirationBasedAuthTokenManagerId }))
      })
    })
  })

  wire.writeResponse(responses.ExpirationBasedAuthTokenManager({ id }))
}

export function ExpirationBasedAuthTokenProviderCompleted (_, context, { requestId, auth }) {
  const request = context.getExpirationBasedAuthTokenProviderRequest(requestId)
  request.resolve({
    expiration: auth.data.expiresInMs != null
      ? new Date(new Date().getTime() + auth.data.expiresInMs)
      : undefined,
    token: context.binder.parseAuthToken(auth.data.auth.data)
  })
  context.removeExpirationBasedAuthTokenProviderRequest(requestId)
}

export function GetRoutingTable (_, context, { driverId, database }, wire) {
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

export function ForcedRoutingTableUpdate (_, context, { driverId, database, bookmarks }, wire) {
  const driver = context.getDriver(driverId)
  const provider = driver._getOrCreateConnectionProvider()

  if (provider._freshRoutingTable) {
    // Removing database from the routing table registry
    provider._routingTableRegistry._remove(database)
    return provider._freshRoutingTable({
      accessMode: 'READ',
      database,
      bookmarks,
      onDatabaseNameResolved: () => {}
    })
      .then(() => wire.writeResponse(responses.Driver({ id: driverId })))
      .catch(error => wire.writeError(error))
  } else {
    wire.writeError('Driver does not support routing')
  }
}

export function ExecuteQuery ({ neo4j }, context, { driverId, cypher, params, config }, wire) {
  const driver = context.getDriver(driverId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      params[key] = context.binder.cypherToNative(value)
    }
  }
  const configuration = {}

  if (config) {
    if ('routing' in config && config.routing != null) {
      switch (config.routing) {
        case 'w':
          configuration.routing = neo4j.routing.WRITERS
          break
        case 'r':
          configuration.routing = neo4j.routing.READERS
          break
        default:
          wire.writeBackendError('Unknown routing: ' + config.routing)
          return
      }
    }

    if ('database' in config) {
      configuration.database = config.database
    }

    if ('impersonatedUser' in config) {
      configuration.impersonatedUser = config.impersonatedUser
    }

    if ('bookmarkManagerId' in config) {
      if (config.bookmarkManagerId !== -1) {
        const bookmarkManager = context.getBookmarkManager(config.bookmarkManagerId)
        if (bookmarkManager == null) {
          wire.writeBackendError(`Bookmark manager ${config.bookmarkManagerId} not found`)
          return
        }
        configuration.bookmarkManager = bookmarkManager
      } else {
        configuration.bookmarkManager = null
      }
    }
  }

  driver.executeQuery(cypher, params, configuration)
    .then(eagerResult => {
      wire.writeResponse(responses.EagerResult(eagerResult, { binder: context.binder }))
    })
    .catch(e => wire.writeError(e))
}

export function FakeTimeInstall ({ mock }, context, _data, wire) {
  context.clock = new mock.FakeTime()
  wire.writeResponse(responses.FakeTimeAck())
}

export function FakeTimeTick (_, context, { incrementMs }, wire) {
  context.clock.tick(incrementMs)
  wire.writeResponse(responses.FakeTimeAck())
}

export function FakeTimeUninstall (_, context, _data, wire) {
  context.clock.restore()
  delete context.clock
  wire.writeResponse(responses.FakeTimeAck())
}
