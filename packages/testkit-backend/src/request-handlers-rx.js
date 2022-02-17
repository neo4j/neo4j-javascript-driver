import * as responses from './responses.js';
import neo4j from './neo4j.js';
import {
  cypherToNative
} from './cypher-native-binders.js'

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
  ResultNext
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
