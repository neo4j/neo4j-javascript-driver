import * as responses from './responses.js';
import neo4j from './neo4j.js';

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

  let id = context.addResult(result)

  wire.writeResponse(responses.Result({ id }))
}
