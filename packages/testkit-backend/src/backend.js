import SocketServer from './socket.server'
import Controller from './controller'

export default class Backend {
  constructor (port, newController = () => new Controller(), newSocketServer = port => new SocketServer(port)) {
    this._socketServer = newSocketServer(port)
    this._controller = newController()

    this._controller.on('response', ({ contextId, response }) => {
      this._socketServer.writeResponse(contextId, response)
    })

    this._socketServer.on('contextOpen', ({ contextId }) => this._controller.onContextOpen(contextId))
    this._socketServer.on('contextClose', ({ contextId }) => this._controller.onContextClose(contextId))

    this._socketServer.on('request', ({ contextId, request }) => { 
      try {
        this._controller.handle(contextId, request)
      } catch (e) {
        this._socketServer.writeBackendError(contextId, e)
      }
    })
  }

  start () {
    this._controller.start()
    this._socketServer.start()
  }

  stop () {
    this._socketServer.stop()
    this._controller.stop()
  }

}
