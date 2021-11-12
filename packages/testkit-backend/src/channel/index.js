import Channel from "./interface"
import SocketChannel from "./socket"
import WebSocketChannel from "./websocket"
/**
 * Channels are the piece of code responsible for communicate with tesktit.
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
