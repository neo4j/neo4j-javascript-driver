export default class Context {
  constructor (shouldRunTest, getFeatures, binder, environmentLogLevel) {
    this._id = 0
    this._drivers = {}
    this._sessions = {}
    this._txs = {}
    this._resolverRequests = {}
    this._errors = {}
    this._shouldRunTest = shouldRunTest
    this._getFeatures = getFeatures
    this._results = {}
    this._bookmarkSupplierRequests = {}
    this._notifyBookmarksRequests = {}
    this._bookmarksManagers = {}
    this._authTokenManagers = {}
    this._authTokenManagerGetAuthRequests = {}
    this._authTokenManagerOnAuthExpiredRequests = {}
    this._temporalAuthTokenProviderRequests = {}
    this._binder = binder
    this._environmentLogLevel = environmentLogLevel
  }

  get binder () {
    return this._binder
  }

  get environmentLogLevel () {
    return this._environmentLogLevel
  }

  addDriver (driver) {
    return this._add(this._drivers, driver)
  }

  addSession (session) {
    return this._add(this._sessions, session)
  }

  addTx (tx, sessionId, resolve, reject) {
    const id = this._add(this._txs, {
      sessionId,
      tx,
      resolve,
      reject
    })
    this._txs[id].id = id
    return id
  }

  addError (error) {
    return this._add(this._errors, error)
  }

  addResolverRequest (resolve, reject) {
    const id = this._add(this._resolverRequests, {
      resolve,
      reject
    })
    return id
  }

  addResult (result) {
    return this._add(this._results, result)
  }

  removeResult (id) {
    delete this._results[id]
  }

  getResult (id) {
    return this._results[id]
  }

  getDriver (id) {
    return this._drivers[id]
  }

  getSession (id) {
    return this._sessions[id]
  }

  getTx (id) {
    return this._txs[id]
  }

  getResultObserver (id) {
    return this._resultObservers[id]
  }

  getError (id) {
    return this._errors[id]
  }

  getResolverRequest (id) {
    return this._resolverRequests[id]
  }

  removeDriver (id) {
    delete this._drivers[id]
  }

  removeSession (id) {
    delete this._sessions[id]
  }

  removeTx (id) {
    delete this._txs[id]
  }

  removeResolverRequest (id) {
    delete this._resolverRequests[id]
  }

  getTxsBySessionId (sessionId) {
    return Object.values(this._txs).filter(tx => tx.sessionId === sessionId)
  }

  getShouldRunTestFunction () {
    return this._shouldRunTest
  }

  getFeatures () {
    return this._getFeatures()
  }

  addBookmarkSupplierRequest (resolve, reject) {
    return this._add(this._bookmarkSupplierRequests, {
      resolve, reject
    })
  }

  removeBookmarkSupplierRequest (id) {
    delete this._bookmarkSupplierRequests[id]
  }

  getBookmarkSupplierRequest (id) {
    return this._bookmarkSupplierRequests[id]
  }

  addNotifyBookmarksRequest (resolve, reject) {
    return this._add(this._notifyBookmarksRequests, {
      resolve, reject
    })
  }

  removeNotifyBookmarksRequest (id) {
    delete this._notifyBookmarksRequests[id]
  }

  getNotifyBookmarksRequest (id) {
    return this._notifyBookmarksRequests[id]
  }

  addBookmarkManager (bookmarkManagerFactory) {
    this._id++
    this._bookmarksManagers[this._id] = bookmarkManagerFactory(this._id)
    return this._id
  }

  getBookmarkManager (id) {
    return this._bookmarksManagers[id]
  }

  removeBookmarkManager (id) {
    delete this._bookmarksManagers[id]
  }

  addAuthTokenManager (authTokenManagersFactory) {
    this._id++
    this._authTokenManagers[this._id] = authTokenManagersFactory(this._id)
    return this._id
  }

  getAuthTokenManager (id) {
    return this._authTokenManagers[id]
  }

  removeAuthTokenManager (id) {
    delete this._authTokenManagers[id]
  }

  addAuthTokenManagerGetAuthRequest (resolve, reject) {
    return this._add(this._authTokenManagerGetAuthRequests, {
      resolve, reject
    })
  }

  getAuthTokenManagerGetAuthRequest (id) {
    return this._authTokenManagerGetAuthRequests[id]
  }

  removeAuthTokenManagerGetAuthRequest (id) {
    delete this._authTokenManagerGetAuthRequests[id]
  }

  addAuthTokenManagerOnAuthExpiredRequest (request) {
    return this._add(this._authTokenManagerOnAuthExpiredRequests, request)
  }

  removeAuthTokenManagerOnAuthExpiredRequest (id) {
    delete this._authTokenManagerOnAuthExpiredRequests[id]
  }

  addTemporalAuthTokenProviderRequest (resolve, reject) {
    return this._add(this._temporalAuthTokenProviderRequests, { resolve, reject })
  }

  getTemporalAuthTokenProviderRequest (id) {
    return this._temporalAuthTokenProviderRequests[id]
  }

  removeTemporalAuthTokenProviderRequest (id) {
    delete this._temporalAuthTokenProviderRequests[id]
  }

  _add (map, object) {
    this._id++
    map[this._id] = object
    return this._id
  }
}
