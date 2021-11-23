import Channel from './interface'
import net from 'net'
import { randomBytes } from 'crypto'
import Protocol from './testkit-protocol'

function generateRandomId () {
  return randomBytes(16).toString('hex')
}

/**
 * This is communication channel handles the direct communication with TestKit using its protocol.
 *
 * This implementation is meant to be run in NodeJS, it doesn't support Browser.
 */
export default class SocketChannel extends Channel {
  constructor(port, newProtocol = stream => new Protocol(stream), newId = generateRandomId ) {
    super()
    this._newProtocol = newProtocol
    this._server = null
    this._newId = newId
    this._clients = new Map()
    this._port = port
  }

  start () {
    if (!this._server) {
      this._server = net.createServer(this._handleConnection.bind(this))

      this._server.listen(this._port, () => {
        console.log('Listening')
      })

      this._server.on('close', () => this.emit('close'))
    }
  }

  _handleConnection(connection) {
    console.log('Backend connected')
        
    const contextId = this._newId()
    const protocol = this._newProtocol(connection)

    this._clients.set(contextId, {
      protocol,
      connection
    })

    this.emit('contextOpen', { contextId })
    protocol.on('request', request => this.emit('request', { contextId, request }) )
    protocol.on('error', e => this._writeBackendError(contextId, e))
    
    connection.on('end', () =>  { 
      if (this._clients.has(contextId)) {
        this._clients.get(contextId).protocol.stop()
      }
      this._clients.delete(contextId)
      this.emit('contextClose', { contextId })
    })

    protocol.start()
  }

  writeResponse (contextId, response) {
    if (this._clients.has(contextId)) {
      const { protocol, connection } = this._clients.get(contextId)
      const chunk = protocol.serializeResponse(response)
      connection.write(chunk, 'utf8', () => {})
    }
  }

  writeBackendError (contextId, error) {
    this.writeResponse(contextId, { name: 'BackendError', data:  { msg: error } })
  }

  stop () {
    if (this._server) {
      this._server.close()
      this._server = null
      this._clients.forEach(client => client.protocol.stop())
      this._clients = new Map()
    }
  }
}
