export default class Context {
  constructor () {
    this._id = 0
    this._drivers = {}
    this._sessions = {}
    this._txs = {}
    this._resultObservers = {}
    this._errors = {}
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

  addResultObserver (observer) {
    return this._add(this._resultObservers, observer)
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

  removeDriver (id) {
    delete this._drivers[id]
  }

  removeSession (id) {
    delete this._sessions[id]
  }

  removeTx (id) {
    delete this._txs[id]
  }

  removeResultObserver (id) {
    delete this._resultObservers[id]
  }

  getResultObserversBySessionId (sessionId) {
    return Object.values(this._resultObservers).filter(
      obs => obs.sessionId === sessionId
    )
  }

  getTxsBySessionId (sessionId) {
    return Object.values(this._txs).filter(tx => tx.sessionId === sessionId)
  }

  _add (map, object) {
    this._id++
    map[this._id] = object
    return this._id
  }
}
