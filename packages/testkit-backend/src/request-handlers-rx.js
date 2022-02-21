import * as responses from './responses.js';
import neo4j from './neo4j.js';
import {
  cypherToNative
} from './cypher-native-binders.js'
import { from } from 'rxjs';

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
  ResolverResolutionCompleted,
  GetRoutingTable,
  ForcedRoutingTableUpdate,
  ResultNext,
  RetryablePositive,
  RetryableNegative,
} from './request-handlers.js';

export function NewSession(context, data, wire) {
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
  const session = driver.rxSession({
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
    .toPromise()
    .then(() => wire.writeResponse(responses.Session({ id: sessionId })))
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

  result[Symbol.asyncIterator] = () => toAsyncIterator(result)

  let id = context.addResult(result)

  wire.writeResponse(responses.Result({ id }))
}

export function ResultConsume (context, data, wire) {
  const { resultId } = data
  const result = context.getResult(resultId)

  return result.consume()
    .toPromise()
    .then(summary => {
      wire.writeResponse(responses.Summary({ summary }))
    }).catch(e => wire.writeError(e))
}


export function SessionBeginTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata, timeout } = data
  const session = context.getSession(sessionId)
  
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
    return
  }
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
  result[Symbol.asyncIterator] = () => toAsyncIterator(result)
  const id = context.addResult(result)

  wire.writeResponse(responses.Result({ id }))
}

export function TransactionRollback (context, data, wire) {
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

export function TransactionCommit (context, data, wire) {
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

export function SessionReadTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  
  try {
    return session.readTransaction(tx => {
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
    return
  }
}

export function SessionWriteTransaction (context, data, wire) {
  const { sessionId, txMeta: metadata } = data
  const session = context.getSession(sessionId)
  
  try {
    return session.writeTransaction(tx => {
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
    return
  }
}


function toAsyncIterator(result) {
  function queueObserver () {
    function createResolvablePromise (){
      const resolvablePromise = {}
      resolvablePromise.promise = new Promise((resolve, reject) => {
        resolvablePromise.resolve = resolve
        resolvablePromise.reject = reject
      });
      return resolvablePromise;
    }


    function isError(elementOrError){
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
      _push(element) {
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
          const element =  await promiseHolder.resolvable.promise
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
  records.subscribe(observer);
  
  const state = {
    finished: false
  }

  return {
    next: async () => {
      if (state.finished) {
        return { done: true }
      }
      const next = observer.dequeue()
      if (next.done) {
        state.finished = next.done
        state.summary = next.value
      }
      return next
    },
    return: async (value) => {
      state.finished = true
      state.summary = value
      return { done: true, value: value }
    }
  }
}
