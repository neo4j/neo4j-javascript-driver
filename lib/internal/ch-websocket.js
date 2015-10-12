
import {debug} from "./log";
import {HeapBuffer} from "./buf";

/**
 * Create a new WebSocketChannel.
 */
class WebSocketChannel {
  constructor (opts) {
    this._url = "ws:" + opts.host + ":" + (opts.port || 7688);
    this._ws = new WebSocket(this._url);
    this._ws.binaryType = "arraybuffer";
    this._open = true;
    this._pending = [];

    let self = this;
    this._ws.onopen = function() {
      // Drain all pending messages
      let pending = self._pending;
      self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    };

    this._ws.onmessage = (event) => {
      if( self.onmessage ) {
        self.onmessage( new HeapBuffer( event.data ) );
      } 
    };
  }
  write ( buffer ) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if( this._pending !== null ) {
      this._pending.push( buffer );
    } else if( buffer instanceof HeapBuffer ) {
      this._ws.send( buffer._buffer );
    } else {
      throw new Exception( "Don't know how to send buffer: " + buffer );
    }
  }
  close ( cb ) {
    if(cb) {
      this._ws.onclose(cb);
    }
    this._open = false;
    this._ws.close();
  }
}

let available = typeof WebSocket !== 'undefined';
let websocketChannelModule = {channel: WebSocketChannel, available: available};

export default websocketChannelModule
