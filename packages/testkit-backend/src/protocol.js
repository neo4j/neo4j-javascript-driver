
import EventEmitter from 'events'

export default class Protocol extends EventEmitter {
  constructor () {
    super()
    console.log('Backend connected')
    this._inRequest = false
    this._request = ''
  }

  // Called whenever a new line is received.
  processLine (line) {
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
          this.emit('error', e)
        }
        this._request = ''
        this._inRequest = false
        break
      default:
        if (!this._inRequest) {
          throw new Error('Line while not in request')
        }
        this._request += line
        break
    }
  }

  serializeResponse (name, data) {
    console.log('> writing response', name, data)
    let response = {
      name: name,
      data: data
    }
    response = this._stringify(response)
    return  ['#response begin', response, '#response end'].join('\n') + '\n'
  }

  _emitRequest () {
    const request = JSON.parse(this._request)
    const { name, data } = request
    console.log('> Got request ' + name, data)
    this.emit('request', { name, data })
  }
  
  _stringify (val) {
    return JSON.stringify(val, (_, value) =>
      typeof value === 'bigint' ? `${value}n` : value
    )
  }
}