
var WebSocketChannel = require("./ch-websocket").WebSocketChannel;
var NodeChannel = require("./ch-node").NodeChannel;
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


var MAX_CHUNK_SIZE = 16383,

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

/**
 * A connector manages sending and recieving messages over a channel.
 * @param url - 'neo4j'-prefixed URL to Neo4j Bolt endpoint
 * @param Channel - a channel constructor function
 */
function Connector(url, Channel) {
    this._outbox = [];
    this._responseHandlers = {};
    this._requestId = 0;

    var self = this;
    this._ch = new Channel({
      url: url,
      onmessage: function(buffer) {
        console.log( buffer );
      }
    });
}

/** Queue an initialize message to be sent to the database */
Connector.prototype.initialize = function( clientName, cb ) {
  var id = this._requestId++;
  this._outbox.push( [INIT, [clientName]] );
  this._responseHandlers[id] = cb;
}

/**
 * Synchronize - flush all queued outgoing messages and route their responses
 * to their respective handlers.
 */
Connector.prototype.sync = function() {
  console.log( this._outbox );
}

function connect( url ) {
    return new Connector( url, Channel );
}

module.exports = {
    "connect" : connect,
    "Connector" : Connector
}
