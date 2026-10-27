import Channel from './interface.js'
import SocketChannel from './socket.js'
import WebSocketChannel from './websocket.js'
/**
 * Channels are the pieces of code responsible for communicating with testkit.
 *
 * {@link SocketChannel} is a server socket implementation meant to be used to talk directly to the
 * testkit server.
 *
 * {@link WebSocketChannel} is a client implementation used for connection to other testkit-backend for receiving
 * messages.
 */
export default Channel
export {
  SocketChannel,
  WebSocketChannel
}
