import { EventEmitter } from 'events'

/**
 * Controller is the unit responsible for redirecting the requests to the correct handler and managing the
 * creation and destruction of the request contexts.
 *
 * @event response Event triggered whith response to the request handled.
 */
export default class Controller extends EventEmitter {

  start () {

  }

  stop () {

  }

  openContext (contextId) {
    throw new Error('not implemented')
  }

  closeContext (contextId) {
    throw new Error('not implemented')
  }

  handle(contextId, request) {
    throw new Error('not implemented')
  }
}
