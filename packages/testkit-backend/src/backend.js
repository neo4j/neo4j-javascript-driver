import Channel from './channel'
import Controller from './controller'

/**
 * Binds Channel and Controller
 */
export default class Backend {
  /**
   *
   * @param {function():Controller} newController The controller factory function
   * @param {function():Channel} newChannel The channel factory function
   */
  constructor (newController, newChannel) {
    this._channel = newChannel()
    this._controller = newController()

    this._controller.on('response', ({ contextId, response }) => {
      this._channel.writeResponse(contextId, response)
    })

    this._channel.on('contextOpen', ({ contextId }) => this._controller.openContext(contextId))
    this._channel.on('contextClose', ({ contextId }) => this._controller.closeContext(contextId))

    this._channel.on('request', ({ contextId, request }) => {
      try {
        this._controller.handle(contextId, request)
      } catch (e) {
        this._channel.writeBackendError(contextId, e.message)
      }
    })
  }

  start () {
    this._controller.start()
    this._channel.start()
  }

  stop () {
    this._channel.stop()
    this._controller.stop()
  }

}
