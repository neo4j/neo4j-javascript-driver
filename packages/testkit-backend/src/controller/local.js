import Context from '../context'
import Controller from './interface'
import stringify from '../stringify'


/**
 * Local controller handles the requests locally by redirecting them to the correct request handler/service.
 *
 * This controller is used when testing browser and locally.
 */
export default class LocalController extends Controller {

  constructor(requestHandlers = {}, shouldRunTest = () => {}) {
    super()
    this._requestHandlers = requestHandlers
    this._shouldRunTest = shouldRunTest
    this._contexts = new Map()
  }

  openContext (contextId) {
    this._contexts.set(contextId, new Context(this._shouldRunTest))
  }

  closeContext (contextId) {
    this._contexts.delete(contextId)
  }
  
  handle (contextId, { name, data }) {
    if (!this._contexts.has(contextId)) {
      throw new Error(`Context ${contextId} does not exist`)
    } else if (!(name in this._requestHandlers)) {
      console.log('Unknown request: ' + name)
      console.log(stringify(data))
      throw new Error(`Unknown request: ${name}`)
    }

    this._requestHandlers[name](this._contexts.get(contextId), data, {
      writeResponse: (name, data) => this._writeResponse(contextId, name, data),
      writeError: (e) => this._writeError(contextId, e),
      writeBackendError: (msg) => this._writeBackendError(contextId, msg)
    })

  }

  _writeResponse (contextId, name, data) {
    console.log('> writing response', name, data)
    let response = {
      name: name,
      data: data
    }

    this.emit('response', { contextId, response })
  }

  _writeBackendError (contextId, msg) {
    this._writeResponse(contextId, 'BackendError', { msg: msg })
  }

  _writeError (contextId, e) {
    if (e.name) {
      const id = this._contexts.get(contextId).addError(e)
      this._writeResponse(contextId, 'DriverError', {
        id,
        msg: e.message + ' (' + e.code + ')',
        code: e.code
      })
      return
    }
    this._writeBackendError(contextId, e)
  }
  
}
