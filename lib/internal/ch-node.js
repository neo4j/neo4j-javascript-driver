
import net from 'net';
import {NodeBuffer} from './buf';

let CONNECTION_IDGEN = 0;

class NodeChannel {
  constructor (opts) {
    let self = this;

    this.id = CONNECTION_IDGEN++;
    this.available = true;
    this._pending = [];
    this._conn = net.connect((opts.port || 7687), opts.host, () => {
      // Drain all pending messages
      let pending = self._pending;
      self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    });

    this._conn.on('data', ( buffer ) => {
       // console.log( "[Conn#"+self.id+"] RECV: ", new NodeBuffer( buffer ).toString() );
      if( self.onmessage ) {
        self.onmessage( new NodeBuffer( buffer ) );
      }
    });
  }
  write ( buffer ) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if( this._pending !== null ) {
      this._pending.push( buffer );
    } else if( buffer instanceof NodeBuffer ) {
      // console.log( "[Conn#"+this.id+"] SEND: ", buffer.toString() );
      this._conn.write( buffer._buffer );
    } else {
      throw new Error( "Don't know how to write: " + buffer );
    }
  }
}
let nodeChannelModule = {channel: NodeChannel, available: true};

try {
  // Only define this module if 'net' is available
  require.resolve("net");
} catch(e) {
  nodeChannelModule = { available : false };
}

export default nodeChannelModule
