// import WebSocket from "ws"
import Channel from "./interface"

export default class WebSocketChannel extends Channel {

  constructor(address) {
    super()
    this._adddress = address
    this._ws = null
  }

  start () {
    if(!this._ws) {
      this._ws = new WebSocket(this._adddress)
      // this._ws.on('message', buffer => {
      //   const message = JSON.parse(buffer.toString())
      this._ws.onmessage = ({ data: message }) => {
        console.log(message)
        console.debug('[WebSocketChannel] Received messsage', message)
        const { messageType, contextId, data } =  JSON.parse(message)
        
        switch (messageType) {
          case 'contextOpen':
          case 'contextClose':
            this.emit(messageType, data)
            break
          case 'request':
            this.emit(messageType, { contextId, request: data })
            break
          default:
            console.error(`[WebSocketChannel] ${messageType} is not a valid message type`)
        }
      }

      // this._ws.on('close', () => this.emit('close'))
      this._ws.onclose = () => this.emit('close')
    }
  }

  stop () {
    if(this._ws) {
      this._ws.close()
      this._ws = null
    }
  }

  writeResponse (contextId, response) {
    if (this._ws) {
      console.debug('[WebSocketChannel] Wring response', { contextId, response })
      return this._ws.send(JSON.stringify({ contextId, response }))
    }
    console.error('[WebSocketChannel] Websocket is not connected')
  }

}
