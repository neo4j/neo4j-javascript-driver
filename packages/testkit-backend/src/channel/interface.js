import { EventEmitter } from "events"

/**
 * Defines the interface used for receiving commands form teskit.
 *
 * This is a thin layer only responsible for receiving and sending messages from and to testkit.
 *
 * @event contextOpen This event is triggered when a new testkit client starts its work.
 * @event contextClose This event is triggered when an existing client finishes it work
 * @event request This event is triggered when the channel receives a request
 */
export default class Channel extends EventEmitter {

  start () {
    throw Error('Not implemented')
  }

  stop () {
    throw Error('Not implemented')
  }

  writeResponse (contextId, response) {
    throw Error('Not implemented')
  }

  writeBackendError (contextId, error) {
    this.writeResponse(contextId, { name: 'BackendError', data:  { msg: error } })
  }

}
