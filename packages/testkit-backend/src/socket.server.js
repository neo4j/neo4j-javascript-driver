
import readline from 'readline'
import { EventEmitter } from 'events'
import net from 'net'
import { randomBytes } from 'crypto'
import Protocol from './protocol'

function generateRandomId () {
  return randomBytes(16).toString()
}

export default class SocketServer extends EventEmitter {
  constructor(port, newProtocol = () => new Protocol(), newId = generateRandomId ) {
    super()
    this._newProtocol = newProtocol
    this._server = null
    this._newId = newId
    this._clients = new Map()
    this._port = port
  }

  start () {
    if (!this._server) {
      this._server = net.createServer(connection => {
        const contextId = this._newId()
        console.log(`[${contextId}] Creating connection`)
        const protocol = this._newProtocol()

        this._clients.set(contextId, {
          protocol,
          connection
        })

        this.emit('contextOpen', { contextId })
        protocol.on('request', request => this.emit('request', { contextId, request }) )
        protocol.on('error', e => this.writeBackendError(contextId, e))
        
        connection.on('end', () =>  { 
          this._clients.delete(contextId)
          this.emit('contextClose', { contextId })
        })

        const iface = readline.createInterface(connection, null)
        iface.on('line', protocol.processLine.bind(protocol))
      })

      this._server.listen(this._port, () => {
        console.log('Listening')
      })

      this._server.on('close', () => this.emit('close'))
    }
  }

  writeResponse (contextId, name, data) {
    if (this._clients.has(contextId)) {
      const { protocol, connection } = this._clients.get(contextId)
      const chunk = protocol.serializeResponse(name, data)
      connection.write(chunk, 'utf8', () => {})
      
    }
  }

  writeBackendError (contextId, error) {
    this.writeResponse(contextId, 'BackendError', { msg: error})
  }

  stop () {
    if (this._server) {
      this._server.close()
      this._clients = new Map()
    }
  }

}
