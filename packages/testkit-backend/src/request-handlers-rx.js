import * as responses from './responses.js'
import { from } from 'rxjs'

// Handlers which didn't change depending
export {
  NewDriver,
  DriverClose,
  SessionLastBookmarks,
  StartTest,
  GetFeatures,
  VerifyConnectivity,
  GetServerInfo,
  CheckMultiDBSupport,
  CheckSessionAuthSupport,
  ResolverResolutionCompleted,
  GetRoutingTable,
  ForcedRoutingTableUpdate,
  ResultNext,
  RetryablePositive,
  RetryableNegative,
  NewBookmarkManager,
  BookmarkManagerClose,
  BookmarksSupplierCompleted,
  BookmarksConsumerCompleted,
  StartSubTest,
  ExecuteQuery,
  NewAuthTokenProvider,
  AuthTokenProviderCompleted,
  AuthTokenProviderClose,
  FakeTimeInstall,
  FakeTimeTick,
  FakeTimeUninstall
} from './request-handlers.js'

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
  const driver = context.getDriver(driverId)
  const session = driver.rxSession({
    defaultAccessMode: accessMode,
    bookmarks,
    database,
    fetchSize,
    impersonatedUser,
    bookmarkManager,
    notificationFilter
  })
  const id = context.addSession(session)
  wire.writeResponse(responses.Session({ id }))
}

export function SessionClose (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  return session
    .close()
    .toPromise()
    .then(() => wire.writeResponse(responses.Session({ id: sessionId })))
    .catch(err => wire.writeError(err))
}

export function SessionRun (_, context, data, wire) {
  const { sessionId, cypher, timeout } = data
  const session = context.getSession(sessionId)
  const params = context.binder.objectToNative(data.params)
  const metadata = context.binder.objectToNative(data.txMeta)

  let rxResult
  try {
    rxResult = session.run(cypher, params, { metadata, timeout })
  } catch (e) {
    console.log('got some err: ' + JSON.stringify(e))
    wire.writeError(e)
    return
  }

  rxResult
    ._toObservable()
    .subscribe({
      error: e => wire.writeError(e),
      next: result => {
        result[Symbol.asyncIterator] = () => toAsyncIterator(result)

        const id = context.addResult(result)

        wire.writeResponse(responses.Result({ id }))
      }
    })
}

export function ResultConsume (_, context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)

  return result.consume()
    .toPromise()
    .then(summary => {
      wire.writeResponse(responses.Summary({ summary }, { binder: context.binder }))
    }).catch(e => wire.writeError(e))
}

export function SessionBeginTransaction (_, context, data, wire) {
  const { sessionId, timeout } = data
  const session = context.getSession(sessionId)
  const metadata = context.binder.objectToNative(data.txMeta)

  try {
    return session.beginTransaction({ metadata, timeout })
      .toPromise()
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

export function TransactionRun (_, context, data, wire) {
  const { txId, cypher, params } = data
  const tx = context.getTx(txId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      params[key] = context.binder.cypherToNative(value)
    }
  }

  tx.tx.run(cypher, params)
    ._toObservable()
    .subscribe({
      error: e => wire.writeError(e),
      next: result => {
        result[Symbol.asyncIterator] = () => toAsyncIterator(result)

        const id = context.addResult(result)

        wire.writeResponse(responses.Result({ id }))
      }
    })
}

export function TransactionRollback (_, context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.rollback()
    .toPromise()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function TransactionCommit (_, context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.commit()
    .toPromise()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => {
      console.log('got some err: ' + JSON.stringify(e))
      wire.writeError(e)
    })
}

export function TransactionClose (_, context, data, wire) {
  const { txId: id } = data
  const { tx } = context.getTx(id)
  return tx.close()
    .toPromise()
    .then(() => wire.writeResponse(responses.Transaction({ id })))
    .catch(e => wire.writeError(e))
}

export function SessionReadTransaction (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const metadata = context.binder.objectToNative(data.txMeta)

  try {
    return session.executeRead(tx => {
      return from(new Promise((resolve, reject) => {
        const id = context.addTx(tx, sessionId, resolve, reject)
        wire.writeResponse(responses.RetryableTry({ id }))
      }))
    }, { metadata })
      .toPromise()
      .then(() => wire.writeResponse(responses.RetryableDone()))
      .catch(e => wire.writeError(e))
  } catch (e) {
    wire.writeError(e)
  }
}

export function SessionWriteTransaction (_, context, data, wire) {
  const { sessionId } = data
  const session = context.getSession(sessionId)
  const metadata = context.binder.objectToNative(data.txMeta)

  try {
    return session.executeWrite(tx => {
      return from(new Promise((resolve, reject) => {
        const id = context.addTx(tx, sessionId, resolve, reject)
        wire.writeResponse(responses.RetryableTry({ id }))
      }))
    }, { metadata })
      .toPromise()
      .then(() => wire.writeResponse(responses.RetryableDone()))
      .catch(e => wire.writeError(e))
  } catch (e) {
    wire.writeError(e)
  }
}

function toAsyncIterator (result) {
  function queueObserver () {
    function createResolvablePromise () {
      const resolvablePromise = {}
      resolvablePromise.promise = new Promise((resolve, reject) => {
        resolvablePromise.resolve = resolve
        resolvablePromise.reject = reject
      })
      return resolvablePromise
    }

    function isError (elementOrError) {
      return elementOrError instanceof Error
    }

    const buffer = []
    const promiseHolder = { resolvable: null }

    const observer = {
      next: (record) => {
        observer._push({ done: false, value: record })
      },
      complete: (summary) => {
        observer._push({ done: true, value: summary })
      },
      error: (error) => {
        observer._push(error)
      },
      _push (element) {
        if (promiseHolder.resolvable !== null) {
          const resolvable = promiseHolder.resolvable
          promiseHolder.resolvable = null
          if (isError(element)) {
            resolvable.reject(element)
          } else {
            resolvable.resolve(element)
          }
        } else {
          buffer.push(element)
        }
      },
      dequeue: async () => {
        if (buffer.length > 0) {
          const element = buffer.shift()
          if (isError(element)) {
            throw element
          }
          return element
        }
        promiseHolder.resolvable = createResolvablePromise()
        return await promiseHolder.resolvable.promise
      },
      head: async () => {
        if (buffer.length > 0) {
          const element = buffer[0]
          if (isError(element)) {
            throw element
          }
          return element
        }
        promiseHolder.resolvable = createResolvablePromise()
        try {
          const element = await promiseHolder.resolvable.promise
          buffer.unshift(element)
          return element
        } catch (error) {
          buffer.unshift(error)
          throw error
        }
      },
      get size () {
        return buffer.length
      }
    }

    return observer
  }
  const records = result.records()

  const observer = queueObserver()
  records.subscribe(observer)

  const state = {
    finished: false
  }

  return {
    next: async () => {
      if (state.finished) {
        return { done: true }
      }
      const next = await observer.dequeue()
      if (next.done) {
        state.finished = next.done
        state.summary = next.value
      }
      return next
    },
    return: async (value) => {
      state.finished = true
      state.summary = value
      return { done: true, value }
    }
  }
}
