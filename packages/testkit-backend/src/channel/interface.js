import { EventEmitter } from "events"

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
