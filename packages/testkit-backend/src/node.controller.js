import Context from './context'
import Controller from './controller'
import * as _requestHandlers from './request-handlers'


export default class NodeController extends Controller {

  constructor(requestHandlers = _requestHandlers) {
    super()
    this._requestHandlers = requestHandlers
    this._contexts = new Map()
  }

  onContextOpen(contextId) {
    this._contexts.set(contextId, new Context())
  }

  onContextClose(contextId) {
    this._contexts.delete(contextId)
  }

  
  handle(contextId, { name, data }) {
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
