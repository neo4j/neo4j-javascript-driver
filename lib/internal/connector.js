
import WebSocketChannel from "./ch-websocket";
import NodeChannel from "./ch-node";
import chunking from "./chunking";
import packstream from "./packstream";
import {alloc} from "./buf";

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
FAILURE = 0x7F;         // 0111 1111 // FAILURE <metadata>

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
function Connection(channel) {
    let IN_HANDSHAKE = 0, ONLINE = 1, ERROR = 2;

    this._state = IN_HANDSHAKE;
    this._responseHandlers = {};
    this._outboundExchangeId = 0;
    this._inboundExchangeId = 0;
    this._ch = channel;
    this._dechunker = new chunking.Dechunker();
    this._chunker = new chunking.Chunker( channel );
    this._packer = new packstream.Packer( this._chunker );
    this._unpacker = new packstream.Unpacker();

    let self = this;
    this._ch.onmessage = (buf) => {
      switch( self._state ) {
        case IN_HANDSHAKE:
          if( buf.readInt32() == 1 ) {
            self._state = ONLINE;
            // TODO: Write tests for and handle getting > and < 4 bytes here
          } else {
            self._state = ERROR;
            // TODO: Trigger an error callback
          }
          break;
        case ONLINE:
          this._dechunker.write( buf );
          break;
      }
    };

    this._dechunker.onmessage = (buf) => {
      self._handleIncomingMessage( self._unpacker.unpack( buf ) );
    }

    let version_proposal = alloc( 4 * 4 );
    version_proposal.writeInt32( 1 );
    version_proposal.writeInt32( 0 );
    version_proposal.writeInt32( 0 );
    version_proposal.writeInt32( 0 );
    version_proposal.reset();
    this._ch.write( version_proposal );
}

/** Queue an INIT-message to be sent to the database */
Connection.prototype.initialize = ( clientName, onSuccess ) => {
  this._regCallback( null, onSuccess );
  this._packer.packStruct( INIT, [clientName] );
  this._chunker.messageBoundary();
}

/** Queue a RUN-message to be sent to the database */
Connection.prototype.run = ( statement, params, onSuccess ) => {
  this._regCallback( null, onSuccess );
  this._packer.packStruct( RUN, [statement, params] );
  this._chunker.messageBoundary();
}

/** Queue a PULL_ALL-message to be sent to the database */
Connection.prototype.pullAll = ( onRecord, onSuccess ) => {
  this._regCallback( onRecord, onSuccess );
  this._packer.packStruct( PULL_ALL );
  this._chunker.messageBoundary();
}

/** Queue a DISCARD_ALL-message to be sent to the database */
Connection.prototype.discardAll = ( onSuccess ) => {
  this._regCallback( null, onSuccess );
  this._packer.packStruct( DISCARD_ALL );
  this._chunker.messageBoundary();
}

/** Queue a ACK_FAILURE-message to be sent to the database */
Connection.prototype.ackFailure = ( onSuccess ) => {
  this._regCallback( null, onSuccess );
  this._packer.packStruct( ACK_FAILURE );
  this._chunker.messageBoundary();
}

/** Register a callback to handle the next result stream */
Connection.prototype._regCallback = ( onRecord, onSuccess ) => {
  let id = this._outboundExchangeId;
  this._outboundExchangeId++;
  this._responseHandlers[id] = [onRecord, onSuccess];
}

/**
 * Synchronize - flush all queued outgoing messages and route their responses
 * to their respective handlers.
 */
Connection.prototype.sync = function() {
  this._chunker.flush();
}

Connection.prototype._handleIncomingMessage = ( msg ) => {
  switch( msg.signature ) {
    case RECORD:
      this._onRecord( msg.fields );
      break;
    case SUCCESS:
      this._onRecord( msg.fields );
      break;
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
