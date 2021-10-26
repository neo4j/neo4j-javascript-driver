import { EventEmitter } from 'events'

export default class Controller extends EventEmitter {

  start () {

  }

  stop () {

  }

  onContextOpen(contextId) {
    throw new Error('not implemented')
  }

  onContextClose(contextId) {
    throw new Error('not implemented')
  }

  handle(contextId, name, data) {
    throw new Error('not implemented')
  }
}