
import WebSocketChannel from "./ch-websocket";
import NodeChannel from "./ch-node";
import chunking from "./chunking";
import packstream from "./packstream";
import {alloc} from "./buf";
import neo4j from "../neo4j";

let Channel;
if( WebSocketChannel.available ) {
    Channel = WebSocketChannel.channel;
}
else if( NodeChannel.available ) {
    Channel = NodeChannel.channel;
}
else {
    throw new Error("Fatal: No compatible transport available. Need to run on a platform with the WebSocket API.");
}


let
// Signature bytes for each message type
INIT = 0x01,            // 0000 0001 // INIT <user_agent>
ACK_FAILURE = 0x0F,     // 0000 1111 // ACK_FAILURE
RUN = 0x10,             // 0001 0000 // RUN <statement> <parameters>
DISCARD_ALL = 0x2F,     // 0010 1111 // DISCARD *
PULL_ALL = 0x3F,        // 0011 1111 // PULL *
SUCCESS = 0x70,         // 0111 0000 // SUCCESS <metadata>
RECORD = 0x71,          // 0111 0001 // RECORD <value>
IGNORED = 0x7E,         // 0111 1110 // IGNORED <metadata>
FAILURE = 0x7F,         // 0111 1111 // FAILURE <metadata>

// Signature bytes for higher-level graph objects
NODE = 0x4E,
RELATIONSHIP = 0x52,
UNBOUND_RELATIONSHIP = 0x72,
PATH = 0x50;


/** yes, yes, I know URLs and regexes.. But I just need the host and port */
let URLREGEX = new RegExp([
  "[^/]+//",          // scheme
  "(([^:/?#]*)",      // hostname
  "(?::([0-9]+))?)",  // port (optional)
  ".*"].join(""));     // everything else

function host( url ) {
  return url.match( URLREGEX )[2];
}

function port( url ) {
  return url.match( URLREGEX )[3];
}

function NO_OP(){};

let NO_OP_OBSERVER = {
  onNext : NO_OP,
  onCompleted : NO_OP,
  onError : NO_OP
}

/** Maps from packstream structures to Neo4j domain objects */
let mappers = {
  node : ( unpacker, buf ) => {
    return new neo4j.Node( 
      unpacker.unpack(buf),  // Identity
      unpacker.unpack(buf),  // Labels
      unpacker.unpack(buf) ) // Properties
  },
  rel : ( unpacker, buf ) => {
    return new neo4j.Relationship( 
      unpacker.unpack(buf),  // Identity
      unpacker.unpack(buf),  // Start Node Identity
      unpacker.unpack(buf),  // End Node Identity
      unpacker.unpack(buf),  // Type
      unpacker.unpack(buf) ) // Properties
  },
}

/**
 * A connection manages sending and recieving messages over a channel. A
 * connector is very closely tied to the Bolt protocol, it implements the
 * same message structure with very little frills. This means Connectors are
 * naturally tied to a specific version of the protocol, and we expect
 * another layer will be needed to support multiple versions.
 * 
 * The connector tries to batch outbound messages by requiring its users
 * to call 'sync' when messages need to be sent, and it routes response
 * messages back to the originators of the requests that created those
 * response messages.
 * 
 * @param url - 'neo4j'-prefixed URL to Neo4j Bolt endpoint
 * @param channel - channel with a 'write' function and a 'onmessage' 
 *                  callback property
 */
class Connection {
  constructor (channel) {
    /** 
     * An ordered queue of observers, each exchange response (zero or more
     * RECORD messages followed by a SUCCESS message) we recieve will be routed
     * to the next pending observer.
     */
    this._pendingObservers = [];
    this._currentObserver = undefined;
    this._ch = channel;
    this._dechunker = new chunking.Dechunker();
    this._chunker = new chunking.Chunker( channel );
    this._packer = new packstream.Packer( this._chunker );
    this._unpacker = new packstream.Unpacker();
    this._isHandlingFailure = false;

    // For deserialization, explain to the unpacker how to unpack nodes, rels, paths;
    this._unpacker.structMappers[NODE] = mappers.node;
    this._unpacker.structMappers[RELATIONSHIP] = mappers.rel;

    let self = this;
    this._ch.onmessage = (buf) => {
      let proposed = buf.readInt32();
      if( proposed == 1 ) {
        // Ok, protocol running. Simply forward all messages past
        // this to the dechunker
        self._ch.onmessage = (buf) => {
          self._dechunker.write(buf);
        }

        if( buf.hasRemaining() ) {
          self._dechunker.write(buf.readSlice( buf.remaining() ));
        }

      } else {
        // TODO: Report error 
        console.log("FATAL, unknown protocol version:", proposed)
      }
    };

    this._dechunker.onmessage = (buf) => {
      self._handleMessage( self._unpacker.unpack( buf ) );
    }

    let version_proposal = alloc( 4 * 4 );
    version_proposal.writeInt32( 1 );
    version_proposal.writeInt32( 0 );
    version_proposal.writeInt32( 0 );
    version_proposal.writeInt32( 0 );
    version_proposal.reset();
    this._ch.write( version_proposal );
  }
  
  _handleMessage( msg ) {
    switch( msg.signature ) {
      case RECORD:
        this._currentObserver.onNext( msg.fields[0] );
        break;
      case SUCCESS:
        try {
          this._currentObserver.onCompleted( msg.fields[0] );
        } finally {
          this._currentObserver = this._pendingObservers.shift();
        }
        break;
      case FAILURE:
        try {
          this._currentObserver.onError( msg );
        } finally {
          this._currentObserver = this._pendingObservers.shift();
          // Things are now broken. Pending observers will get FAILURE messages routed until
          // We are done handling this failure. 
          if( !this._isHandlingFailure ) {
            this._isHandlingFailure = true;
            let self = this;

            // isHandlingFailure was false, meaning this is the first failure message
            // we see from this failure. We may see several others, one for each message
            // we had "optimistically" already sent after whatever it was that failed.
            // We only want to and need to ACK the first one, which is why we are tracking
            // this _isHandlingFailure thing.
            this._ackFailure({
               onNext: NO_OP,
               onError: NO_OP,
               onCompleted: () => {
                  self._isHandlingFailure = false;
               }
            });
          }
        }
        break;
    }
  }

  /** Queue an INIT-message to be sent to the database */
  initialize( clientName, observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( INIT, [clientName] );
    this._chunker.messageBoundary();
  }

  /** Queue a RUN-message to be sent to the database */
  run( statement, params, observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( RUN, [statement, params] );
    this._chunker.messageBoundary();
  }

  /** Queue a PULL_ALL-message to be sent to the database */
  pullAll( observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( PULL_ALL );
    this._chunker.messageBoundary();
  }

  /** Queue a DISCARD_ALL-message to be sent to the database */
  discardAll( observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( DISCARD_ALL );
    this._chunker.messageBoundary();
  }

  /** Queue a ACK_FAILURE-message to be sent to the database */
  _ackFailure( observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( ACK_FAILURE );
    this._chunker.messageBoundary();
  }

  _queueObserver(observer) {
    observer = observer || NO_OP_OBSERVER;
    if( this._currentObserver === undefined ) {
      this._currentObserver = observer;
    } else {
      this._pendingObservers.push( observer );
    }
  }

  /**
   * Synchronize - flush all queued outgoing messages and route their responses
   * to their respective handlers.
   */
  sync() {
    this._chunker.flush();
  }

  close(cb) {
    this._ch.close(cb);
  }
}

function connect( url ) {
  return new Connection( new Channel({
    host: host(url),
    port: port(url)
  }));
}

export default {
    connect,
    Connection
}
