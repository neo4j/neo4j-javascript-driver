/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import WebSocketChannel from "./ch-websocket";
import NodeChannel from "./ch-node";
import chunking from "./chunking";
import hasFeature from "./features";
import packstream from "./packstream";
import {alloc, CombinedBuffer} from "./buf";
import GraphType from '../graph-types';
import {int, isInt} from '../integer';
import {newError} from './error';

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
ACK_FAILURE = 0x0E,     // 0000 1110 // ACK_FAILURE
RESET = 0x0F,           // 0000 1111 // RESET
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
PATH = 0x50,
//sent before version negotiation
MAGIC_PREAMBLE = 0x6060B017;

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

function NO_OP(){}

let NO_OP_OBSERVER = {
  onNext : NO_OP,
  onCompleted : NO_OP,
  onError : NO_OP
};

/** Maps from packstream structures to Neo4j domain objects */
let _mappers = {
  node : ( unpacker, buf ) => {
    return new GraphType.Node(
      unpacker.unpack(buf), // Identity
      unpacker.unpack(buf), // Labels
      unpacker.unpack(buf)  // Properties
    );
  },
  rel : ( unpacker, buf ) => {
    return new GraphType.Relationship(
      unpacker.unpack(buf),  // Identity
      unpacker.unpack(buf),  // Start Node Identity
      unpacker.unpack(buf),  // End Node Identity
      unpacker.unpack(buf),  // Type
      unpacker.unpack(buf) // Properties
    );
  },
  unboundRel : ( unpacker, buf ) => {
    return new GraphType.UnboundRelationship(
      unpacker.unpack(buf),  // Identity
      unpacker.unpack(buf),  // Type
      unpacker.unpack(buf) // Properties
    );
  },
  path : ( unpacker, buf ) => {
    let nodes = unpacker.unpack(buf),
        rels = unpacker.unpack(buf),
        sequence = unpacker.unpack(buf);
    let prevNode = nodes[0],
        segments = [];

    for (let i = 0; i < sequence.length; i += 2) {
        let relIndex = sequence[i],
            nextNode = nodes[sequence[i + 1]],
            rel;
        if (relIndex > 0) {
            rel = rels[relIndex - 1];
            if( rel instanceof GraphType.UnboundRelationship ) {
              // To avoid duplication, relationships in a path do not contain
              // information about their start and end nodes, that's instead
              // inferred from the path sequence. This is us inferring (and,
              // for performance reasons remembering) the start/end of a rel.
              rels[relIndex - 1] = rel = rel.bind(prevNode.identity, nextNode.identity);
            }
        } else {
            rel = rels[-relIndex - 1];
            if( rel instanceof GraphType.UnboundRelationship ) {
              // See above
              rels[-relIndex - 1] = rel = rel.bind(nextNode.identity, prevNode.identity);
            }
        }
        // Done hydrating one path segment.
        segments.push( new GraphType.PathSegment( prevNode, rel, nextNode ) );
        prevNode = nextNode;
    }
    return new GraphType.Path(nodes[0], nodes[nodes.length - 1],  segments );
  }
};

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
 * @access private
 */
class Connection {
  /**
   * @constructor
   * @param channel - channel with a 'write' function and a 'onmessage'
   *                  callback property
   */
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

    // Set to true on fatal errors, to get this out of session pool.
    this._isBroken = false;

    // For deserialization, explain to the unpacker how to unpack nodes, rels, paths;
    this._unpacker.structMappers[NODE] = _mappers.node;
    this._unpacker.structMappers[RELATIONSHIP] = _mappers.rel;
    this._unpacker.structMappers[UNBOUND_RELATIONSHIP] = _mappers.unboundRel;
    this._unpacker.structMappers[PATH] = _mappers.path;

    let self = this;
    // TODO: Using `onmessage` and `onerror` came from the WebSocket API,
    // it reads poorly and has several annoying drawbacks. Swap to having
    // Channel extend EventEmitter instead, then we can use `on('data',..)`
    this._ch.onmessage = (buf) => {
      let proposed = buf.readInt32();
      if( proposed == 1 ) {
        // Ok, protocol running. Simply forward all messages past
        // this to the dechunker
        self._ch.onmessage = (buf) => {
          self._dechunker.write(buf);
        };

        if( buf.hasRemaining() ) {
          self._dechunker.write(buf.readSlice( buf.remaining() ));
        }

      } else {
        self._handleFatalError(newError("Unknown Bolt protocol version: " + proposed));
      }
    };

    // Listen to connection errors. Important note though;
    // In some cases we will get a channel that is already broken (for instance,
    // if the user passes invalid configuration options). In this case, onerror
    // will have "already triggered" before we add out listener here. So the line
    // below also checks that the channel is not already failed. This could be nicely
    // encapsulated into Channel if we used `on('error', ..)` rather than `onerror=..`
    // as outlined in the comment about `onmessage` further up in this file.
    this._ch.onerror = this._handleFatalError.bind(this);
    if( this._ch._error ) {
      this._handleFatalError(this._ch._error);
    }

    this._dechunker.onmessage = (buf) => {
      self._handleMessage( self._unpacker.unpack( buf ) );
    };

    let handshake = alloc( 5 * 4 );
    //magic preamble
    handshake.writeInt32( MAGIC_PREAMBLE );
    //proposed versions
    handshake.writeInt32( 1 );
    handshake.writeInt32( 0 );
    handshake.writeInt32( 0 );
    handshake.writeInt32( 0 );
    handshake.reset();
    this._ch.write( handshake );
  }

  /**
   * "Fatal" means the connection is dead. Only call this if something
   * happens that cannot be recovered from. This will lead to all subscribers
   * failing, and the connection getting ejected from the session pool.
   *
   * @param err an error object, forwarded to all current and future subscribers
   * @private
   */
  _handleFatalError( err ) {
    this._isBroken = true;
    this._error = err;
    if( this._currentObserver && this._currentObserver.onError ) {
      this._currentObserver.onError(err);
    }
    while( this._pendingObservers.length > 0 ) {
      let observer = this._pendingObservers.shift();
      if( observer && observer.onError ) {
        observer.onError(err);
      }
    }
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
          this._errorMsg = msg;
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
      case IGNORED:
        try {
          if (this._errorMsg && this._currentObserver.onError)
            this._currentObserver.onError(this._errorMsg);
          else if(this._currentObserver.onError)
            this._currentObserver.onError(msg);
        } finally {
          this._currentObserver = this._pendingObservers.shift();
        }
        break;
      default:
        this._handleFatalError(newError("Unknown Bolt protocol message: " + msg));
    }
  }

  /** Queue an INIT-message to be sent to the database */
  initialize( clientName, token, observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( INIT, [clientName, token] );
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

  /** Queue a RESET-message to be sent to the database */
  reset( observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( RESET );
    this._chunker.messageBoundary();
  }

  /** Queue a ACK_FAILURE-message to be sent to the database */
  _ackFailure( observer ) {
    this._queueObserver(observer);
    this._packer.packStruct( ACK_FAILURE );
    this._chunker.messageBoundary();
  }

  _queueObserver(observer) {
    if( this._isBroken ) {
      if( observer && observer.onError ) {
        observer.onError(this._error);
      }
      return;
    }
    observer = observer || NO_OP_OBSERVER;
    observer.onCompleted = observer.onCompleted || NO_OP;
    observer.onError = observer.onError || NO_OP;
    observer.onNext = observer.onNext || NO_OP;
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

  /** Check if this connection is in working condition */
  isOpen() {
    return !this._isBroken && this._ch._open;
  }

  /**
   * Call close on the channel.
   * @param {function} cb - Function to call on close.
   */
  close(cb) {
    this._ch.close(cb);
  }
}

/**
 * Crete new connection to the provided url.
 * @access private
 * @param {string} url - 'neo4j'-prefixed URL to Neo4j Bolt endpoint
 * @param {object} config
 * @return {Connection} - New connection
 */
function connect( url, config = {}) {
  let Ch = config.channel || Channel;
  return new Connection( new Ch({
    host: host(url),
    port: port(url) || 7687,
    // Default to using encryption if trust-on-first-use is available
    encrypted : config.encrypted || hasFeature("trust_on_first_use"),
    // Default to using trust-on-first-use if it is available
    trust : config.trust || (hasFeature("trust_on_first_use") ? "TRUST_ON_FIRST_USE" : "TRUST_SIGNED_CERTIFICATES"),
    trustedCertificates : config.trustedCertificates || [],
    knownHosts : config.knownHosts
  }));
}

export default {
    connect,
    Connection
}
