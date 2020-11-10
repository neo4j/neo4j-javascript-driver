import neo4j from 'neo4j-driver'
import ResultObserver from './result-observer.js'
import { cypherToNative, nativeToCypher } from './cypher-native-binders.js'

export function NewDriver (context, data, { writeResponse }) {
  const {
    uri,
    authorizationToken: { data: authToken },
    userAgent
  } = data
  const driver = neo4j.driver(uri, authToken, { userAgent })
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
  let { driverId, accessMode, bookmarks, database, fetchSize } = data
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
    fetchSize
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
  context.removeSession(sessionId)
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
      const resultObserver = new ResultObserver({ sessionId })
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

export function SessionReadTransaction (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  session
    .readTransaction(
      tx =>
        new Promise((resolve, reject) => {
          const id = context.addTx(tx, sessionId, resolve, reject)
          wire.writeResponse('RetryableTry', { id })
        })
    )
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
  const resultObserver = new ResultObserver({})
  result.subscribe(resultObserver)
  const id = context.addResultObserver(resultObserver)
  wire.writeResponse('Result', { id })
}

export function RetryablePositive (context, data, wire) {
  const { sessionId } = data
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.resolve()
    context.removeTx(tx.id)
  })
}

export function RetryableNegative (context, data, wire) {
  const { sessionId, errorId } = data
  const error = context.getError(errorId) || new Error('Client error')
  context.getTxsBySessionId(sessionId).forEach(tx => {
    tx.reject(error)
    context.removeTx(tx.id)
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
  context.removeTx(id)
}

export function SessionLastBookmarks (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const bookmarks = session.lastBookmark()
  wire.writeResponse('Bookmarks', { bookmarks })
}

export function SessionWriteTransaction (context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  session
    .writeTransaction(
      tx =>
        new Promise((resolve, reject) => {
          const id = context.addTx(tx, sessionId, resolve, reject)
          wire.writeResponse('RetryableTry', { id })
        })
    )
    .then(_ => wire.writeResponse('RetryableDone', null))
    .catch(error => wire.writeError(error))
}
