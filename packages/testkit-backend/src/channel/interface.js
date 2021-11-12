import { EventEmitter } from "events"

/**
 * Defines the interface used for receiving commands form the teskit.
 *
 * This is a thin layer only responsilbe for receive messages and send messages to testkit.
 *
 * @event contextOpen This event is triggered when a new testkit client start its work.
 * @event contextClose This event is triggered when an existing client finish it work
 * @event request Thiis event is triggered when the channel receives a request
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
