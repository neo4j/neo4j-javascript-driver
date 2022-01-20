import readline from 'readline'
import EventEmitter from 'events'
import stringify from '../stringify'

export default class Protocol extends EventEmitter {
  constructor (stream) {
    super()
    this._inRequest = false
    this._request = ''
    this._stream = stream
    this._readlineInterface = null
  }

  start() {
    if (!this._readlineInterface) {
      this._readlineInterface = readline.createInterface(this._stream, null)
      this._readlineInterface.on('line', this._processLine.bind(this))
    }
  }

  stop () {
    if (this._readlineInterface) {
      this._readlineInterface.off('line', this._processLine.bind(this))
      this._readlineInterface = null
    }
  }

  // Called whenever a new line is received.
  _processLine (line) {
    switch (line) {
      case '#request begin':
        if (this._inRequest) {
          throw new Error('Already in request')
        }
        this._inRequest = true
        break
      case '#request end':
        if (!this._inRequest) {
          throw new Error('End while not in request')
        }
        try {
          this._emitRequest()
        } catch (e) {
          console.log('error', e)
          this._emitError(e)
        }
        this._request = ''
        this._inRequest = false
        break
      default:
        if (!this._inRequest) {
          this._emitError(new Error('Line while not in request'))
        }
        this._request += line
        break
    }
  }

  _emitError(e) {
    this.emit('error', e)
  }

  serializeResponse (response) {
    console.log('> writing response', response)
    const responseStr = stringify(response)
    return  ['#response begin', responseStr, '#response end'].join('\n') + '\n'
  }

  _emitRequest () {
    const request = JSON.parse(this._request)
    const { name, data } = request
    console.log('> Got request ' + name, data)
    this.emit('request', { name, data })
  }
  
}
