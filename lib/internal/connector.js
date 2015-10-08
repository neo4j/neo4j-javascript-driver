
var WebSocketChannel = require("./ch-websocket").WebSocketChannel;
var NodeChannel = require("./ch-node").NodeChannel;
var chunking = require("./chunking");
var packstream = require("./packstream");
var alloc = require("./buf").alloc;

var Channel;
if( WebSocketChannel.available )
{
    Channel = WebSocketChannel;
}
else if( NodeChannel.available )
{
    Channel = NodeChannel;
}
else
{
    throw new Error("Fatal: No compatible transport available. Need to run on a platform with the WebSocket API.");
}


var
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
var URLREGEX = new RegExp([
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
    var IN_HANDSHAKE = 0, ONLINE = 1, ERROR = 2;

    this._state = IN_HANDSHAKE;
    this._responseHandlers = {};
    this._requestId = 0;
    this._ch = channel;
    this._chunker = new chunking.Chunker( channel )
    this._out = new packstream.Packer( this._chunker );

    var self = this;
    this._ch.onmessage = function(buf) {
      switch( self._state ) {
        case IN_HANDSHAKE:
          if( buf.readInt32() == 1 ) {
            self._state = ONLINE;
            // TODO: Write tests for and handle getting > and < 4 bytes here
          } else {
            self._state = ERROR;
            // TODO: Trigger an error callback somehow
          }
          break;
        case  ONLINE:
          console.log( buf );
          // TODO: Pass chunk on to dechunker
          break;
      }
    }

    var version_proposal = alloc( 4 * 4 );
    version_proposal.writeInt32( 1 );
    version_proposal.writeInt32( 0 );
    version_proposal.writeInt32( 0 );
    version_proposal.writeInt32( 0 );
    version_proposal.reset();
    this._ch.write( version_proposal );
}

/** Queue an INIT-message to be sent to the database */
Connection.prototype.initialize = function( clientName, cb ) {
  this._regCallback( cb );
  this._out.packStruct( INIT, [clientName] );
  this._chunker.messageBoundary();
}

/** Queue a RUN-message to be sent to the database */
Connection.prototype.run = function( statement, params, cb ) {
  this._regCallback( cb );
  this._out.packStruct( RUN, [statement, params] );
  this._chunker.messageBoundary();
}

/** Queue a PULL_ALL-message to be sent to the database */
Connection.prototype.pullAll = function( cb ) {
  this._regCallback( cb );
  this._out.packStruct( PULL_ALL );
  this._chunker.messageBoundary();
}

/** Queue a DISCARD_ALL-message to be sent to the database */
Connection.prototype.discardAll = function( cb ) {
  this._regCallback( cb );
  this._out.packStruct( DISCARD_ALL );
  this._chunker.messageBoundary();
}

/** Queue a ACK_FAILURE-message to be sent to the database */
Connection.prototype.ackFailure = function( cb ) {
  this._regCallback( cb );
  this._out.packStruct( ACK_FAILURE );
  this._chunker.messageBoundary();
}

/** Register a callback to handle the next result stream */
Connection.prototype._regCallback = function( cb ) {
  var id = this._requestId;
  this._requestId++;
  this._responseHandlers[id] = cb;
}

/**
 * Synchronize - flush all queued outgoing messages and route their responses
 * to their respective handlers.
 */
Connection.prototype.sync = function() {
  this._chunker.flush();
}

function connect( url ) {
  return new Connection( new Channel({
    host: host(url),
    port: port(url)
  }));
}

module.exports = {
    "connect" : connect,
    "Connection" : Connection
}
