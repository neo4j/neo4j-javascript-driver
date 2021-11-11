import Controller from "./interface"
import { WebSocketServer } from "ws"

export default class RemoteController extends Controller {
  constructor(port) {
    super()
    this._port = port
    this._wss = null
    this._ws = null
  }

  start () {
    if (!this._wss) {
      this._wss = new WebSocketServer({ port: this._port })
      this._wss.on('connection', safeRun( ws => this._handleClientConnection(ws)))
      this._wss.on('error', safeRun(error => {
        console.error('[RemoteController] Server error', error)
      }))
    }

  }

  stop () {
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }

    if(this._wss) {
      this._wss.close()
      this._wss = null
    }
  }

  onContextOpen (contextId) {
    this._forwardToConnectedClient('contextOpen', contextId, { contextId })
  }

  onContextClose (contextId) {
    this._forwardToConnectedClient('contextClose', contextId, { contextId })
  }

  handle (contextId, request) {
    this._forwardToConnectedClient('request', contextId, request)
  }

  _handleClientConnection (ws) {
    if (this._ws) {
      console.warn('[RemoteController] Client socket already exists, new connection will be discarded')
      return
    }
    console.log('[RemoteController] Registering client')

    this._ws = ws
    this._ws.on('message', safeRun(buffer  => {
      const message = JSON.parse(buffer.toString())
      console.debug('[RemoteController] Received messsage', message)
      const { contextId, response } = message
      this._writeResponse(contextId, response)
    }))

    this._ws.on('close', () => {
      console.log('[RemoteController] Client connection closed')
      this._ws = null
    })

    this._ws.on('error', safeRun(error => {
      console.error('[RemoteController] Client connection error', error)
    }))

    console.log('[RemoteController] Client registred')
  }

  _forwardToConnectedClient (messageType, contextId, data) {
    if (this._ws) {
      const message = {
        messageType,
        contextId,
        data
      }

      console.info(`[RemoteController] Sending message`, message)
      return this._ws.send(JSON.stringify(message))
    }
    console.error('[RemoteController] There is no client connected')
    this._writeBackendError(contextId, 'No testkit-backend client connected')
  }

  _writeResponse (contextId, response) {
    console.log('> writing response', response)

    this.emit('response', { contextId, response })
  }

  _writeBackendError (contextId, msg) {
    this._writeResponse(contextId, {  name: 'BackendError', data: { msg: msg } })
  }

}


function safeRun (func) {
  return function () {
    const args = [...arguments]
    try {
      return func.apply(null, args)
    } catch (error) {
      console.error(`Error in function '${func.name}' called with arguments: ${JSON.stringify(args)}.`, error)
      throw error
    }
  }
}
