import Context from '../context'
import Controller from './interface'
import stringify from '../stringify'
import { isFrontendError } from '../request-handlers'
import CypherNativeBinders from '../cypher-native-binders'
import FakeTime from '../mock/fake-time'

/**
 * Local controller handles the requests locally by redirecting them to the correct request handler/service.
 *
 * This controller is used when testing browser and locally.
 */
export default class LocalController extends Controller {
  constructor (requestHandlers = {}, shouldRunTest = () => {}, getFeatures = () => [], neo4j) {
    super()
    this._requestHandlers = requestHandlers
    this._shouldRunTest = shouldRunTest
    this._getFeatures = getFeatures
    this._contexts = new Map()
    this._neo4j = neo4j
    this._binder = new CypherNativeBinders(neo4j)
  }

  openContext (contextId) {
    this._contexts.set(contextId, new Context(this._shouldRunTest, this._getFeatures, this._binder, process.env.TEST_LOG_LEVEL))
  }

  closeContext (contextId) {
    this._contexts.delete(contextId)
  }

  async handle (contextId, { name, data }) {
    if (!this._contexts.has(contextId)) {
      throw new Error(`Context ${contextId} does not exist`)
    } else if (!(name in this._requestHandlers)) {
      console.log('Unknown request: ' + name)
      console.log(stringify(data))
      throw new Error(`Unknown request: ${name}`)
    }

    return await this._requestHandlers[name]({
      neo4j: this._neo4j,
      mock: {
        FakeTime
      }
    }, this._contexts.get(contextId), data, {
      writeResponse: (response) => this._writeResponse(contextId, response),
      writeError: (e) => this._writeError(contextId, e),
      writeBackendError: (msg) => this._writeBackendError(contextId, msg)
    })
  }

  _writeResponse (contextId, response) {
    this.emit('response', { contextId, response })
  }

  _writeBackendError (contextId, msg) {
    this._writeResponse(contextId, newResponse('BackendError', { msg }))
  }

  _writeError (contextId, e) {
    console.trace(e)
    if (e.name) {
      if (isFrontendError(e)) {
        this._writeResponse(contextId, newResponse('FrontendError', {
          msg: 'Simulating the client code throwing some error.'
        }))
      } else {
        const id = this._contexts.get(contextId).addError(e)
        this._writeResponse(contextId, writeDriverError(id, e, this._binder))
      }
      return
    }
    this._writeBackendError(contextId, e)
  }
}

function newResponse (name, data) {
  return {
    name, data
  }
}

function writeDriverError (id, e, binder) {
  let cause
  if (e.cause != null) {
    cause = writeGqlError(e.cause, binder)
  }
  return newResponse('DriverError', {
    id,
    errorType: e.name,
    msg: e.message,
    code: e.code,
    gqlStatus: e.gqlStatus,
    statusDescription: e.gqlStatusDescription,
    diagnosticRecord: binder.objectToCypher(e.diagnosticRecord),
    cause,
    classification: e.classification,
    rawClassification: e.rawClassification,
    retryable: e.retriable
  })
}

function writeGqlError (e, binder) {
  let cause
  if (e.cause != null) {
    cause = writeGqlError(e.cause, binder)
  }
  return newResponse('GqlError', {
    msg: e.message,
    gqlStatus: e.gqlStatus,
    statusDescription: e.gqlStatusDescription,
    diagnosticRecord: binder.objectToCypher(e.diagnosticRecord),
    cause,
    classification: e.classification,
    rawClassification: e.rawClassification
  })
}
