import net from 'net'
import readline from 'readline'
import Context from './context.js'
import * as requestHandlers from './request-handlers.js'

class Backend {
  constructor ({ writer }) {
    console.log('Backend connected')
    this._inRequest = false
    this._request = ''
    // Event handlers need to be bound to this instance
    this.onLine = this.onLine.bind(this)
    this._writer = writer
    this._context = new Context()
  }

  // Called whenever a new line is received.
  onLine (line) {
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
          this._handleRequest(this._request)
        } catch (e) {
          this._writeBackendError(e)
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

  _handleRequest (request) {
    request = JSON.parse(request)
    const { name, data } = request
    console.log('> Got request ' + name, data)

    if (name in requestHandlers) {
      requestHandlers[name](this._context, data, {
        writeResponse: this._writeResponse.bind(this),
        writeError: this._writeError.bind(this),
        writeBackendError: this._writeBackendError.bind(this)
      })
      return
    }

    this._writeBackendError('Unknown request: ' + name)
    console.log('Unknown request: ' + name)
    console.log(JSON.stringify(data))
  }

  _writeResponse (name, data) {
    console.log('> writing response', name, data)
    let response = {
      name: name,
      data: data
    }
    response = JSON.stringify(response)
    const lines = ['#response begin', response, '#response end']
    this._writer(lines)
  }

  _writeBackendError (msg) {
    this._writeResponse('BackendError', { msg: msg })
  }

  _writeError (e) {
    if (e.name) {
      const id = this._context.addError(e)
      this._writeResponse('DriverError', {
        id,
        msg: e.message + ' (' + e.code + ')'
      })
      return
    }
    this._writeBackendError(e)
  }
}

function server () {
  const server = net.createServer(conn => {
    const backend = new Backend({
      writer: lines => {
        const chunk = lines.join('\n') + '\n'
        conn.write(chunk, 'utf8', () => {})
      }
    })
    conn.setEncoding('utf8')
    const iface = readline.createInterface(conn, null)
    iface.on('line', backend.onLine)
  })
  server.listen(9876, () => {
    console.log('Listening')
  })
}
server()
