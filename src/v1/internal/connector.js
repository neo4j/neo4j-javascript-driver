/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

import WebSocketChannel from './ch-websocket';
import NodeChannel from './ch-node';
import {Chunker, Dechunker} from './chunking';
import packStreamUtil from './packstream-util';
import {alloc} from './buf';
import {newError, PROTOCOL_ERROR} from './../error';
import ChannelConfig from './ch-config';
import urlUtil from './url-util';
import StreamObserver from './stream-observer';
import {ServerVersion, VERSION_3_2_0} from './server-version';

let Channel;
if( NodeChannel.available ) {
  Channel = NodeChannel.channel;
}
else if( WebSocketChannel.available ) {
    Channel = WebSocketChannel.channel;
}
else {
    throw newError("Fatal: No compatible transport available. Need to run on a platform with the WebSocket API.");
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

//sent before version negotiation
MAGIC_PREAMBLE = 0x6060B017,
DEBUG = false;

/**
 * Very rudimentary log handling, should probably be replaced by something proper at some point.
 * @param actor the part that sent the message, 'S' for server and 'C' for client
 * @param msg the bolt message
 */
function log(actor, msg) {
  if (DEBUG) {
    for(var i = 2; i < arguments.length; i++) {
      msg += " " + JSON.stringify(arguments[i]);
    }
    console.log(actor + ":" + msg);
  }
}

function NO_OP(){}

let NO_OP_OBSERVER = {
  onNext : NO_OP,
  onCompleted : NO_OP,
  onError : NO_OP
};

/**
 * A connection manages sending and receiving messages over a channel. A
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
   * @param {NodeChannel|WebSocketChannel} channel - channel with a 'write' function and a 'onmessage' callback property.
   * @param {string} hostPort - the hostname and port to connect to.
   * @param {boolean} disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   */
  constructor(channel, hostPort, disableLosslessIntegers = false) {
    /**
     * An ordered queue of observers, each exchange response (zero or more
     * RECORD messages followed by a SUCCESS message) we receive will be routed
     * to the next pending observer.
     */
    this.hostPort = hostPort;
    this.server = {address: hostPort};
    this.creationTimestamp = Date.now();
    this._disableLosslessIntegers = disableLosslessIntegers;
    this._pendingObservers = [];
    this._currentObserver = undefined;
    this._ch = channel;
    this._dechunker = new Dechunker();
    this._chunker = new Chunker( channel );

    // initially assume that database supports latest Bolt version, create latest packer and unpacker
    this._packer = packStreamUtil.createLatestPacker(this._chunker);
    this._unpacker = packStreamUtil.createLatestUnpacker(disableLosslessIntegers);

    this._ackFailureMuted = false;
    this._currentFailure = null;

    this._state = new ConnectionState(this);

    // Set to true on fatal errors, to get this out of session pool.
    this._isBroken = false;

    // TODO: Using `onmessage` and `onerror` came from the WebSocket API,
    // it reads poorly and has several annoying drawbacks. Swap to having
    // Channel extend EventEmitter instead, then we can use `on('data',..)`
    this._ch.onmessage = (buf) => {
      const proposed = buf.readInt32();
      if (proposed == 1 || proposed == 2) {
        this._initializeProtocol(proposed, buf);
      } else if (proposed == 1213486160) {//server responded 1213486160 == 0x48545450 == "HTTP"
        this._handleFatalError(newError('Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
          '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)'));
      } else {
        this._handleFatalError(newError('Unknown Bolt protocol version: ' + proposed));
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
      this._handleMessage(this._unpacker.unpack(buf));
    };

    let handshake = alloc( 5 * 4 );
    //magic preamble
    handshake.writeInt32( MAGIC_PREAMBLE );
    //proposed versions
    handshake.writeInt32( 2 );
    handshake.writeInt32( 1 );
    handshake.writeInt32( 0 );
    handshake.writeInt32( 0 );
    handshake.reset();
    this._ch.write( handshake );
  }

  /**
   * Complete protocol initialization.
   * @param {number} version the selected protocol version.
   * @param {BaseBuffer} buffer the handshake response buffer.
   * @private
   */
  _initializeProtocol(version, buffer) {
    // re-create packer and unpacker because version might be lower than we initially assumed
    this._packer = packStreamUtil.createPackerForProtocolVersion(version, this._chunker);
    this._unpacker = packStreamUtil.createUnpackerForProtocolVersion(version, this._disableLosslessIntegers);

    // Ok, protocol running. Simply forward all messages to the dechunker
    this._ch.onmessage = buf => this._dechunker.write(buf);

    if (buffer.hasRemaining()) {
      this._dechunker.write(buffer.readSlice(buffer.remaining()));
    }
  }

  /**
   * "Fatal" means the connection is dead. Only call this if something
   * happens that cannot be recovered from. This will lead to all subscribers
   * failing, and the connection getting ejected from the session pool.
   *
   * @param err an error object, forwarded to all current and future subscribers
   * @protected
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
    if (this._isBroken) {
      // ignore all incoming messages when this connection is broken. all previously pending observers failed
      // with the fatal error. all future observers will fail with same fatal error.
      return;
    }

    const payload = msg.fields[0];

    switch( msg.signature ) {
      case RECORD:
        log("S", "RECORD", msg);
        this._currentObserver.onNext( payload );
        break;
      case SUCCESS:
        log("S", "SUCCESS", msg);
        try {
          this._currentObserver.onCompleted( payload );
        } finally {
          this._updateCurrentObserver();
        }
        break;
      case FAILURE:
        log("S", "FAILURE", msg);
        try {
          this._currentFailure = newError(payload.message, payload.code);
          this._currentObserver.onError( this._currentFailure );
        } finally {
          this._updateCurrentObserver();
          // Things are now broken. Pending observers will get FAILURE messages routed until we are done handling this failure.
          this._ackFailureIfNeeded();
        }
        break;
      case IGNORED:
        log("S", "IGNORED", msg);
        try {
          if (this._currentFailure && this._currentObserver.onError)
            this._currentObserver.onError(this._currentFailure);
          else if(this._currentObserver.onError)
            this._currentObserver.onError(newError('Ignored either because of an error or RESET'));
        } finally {
          this._updateCurrentObserver();
        }
        break;
      default:
        this._handleFatalError(newError("Unknown Bolt protocol message: " + msg));
    }
  }

  /** Queue an INIT-message to be sent to the database */
  initialize( clientName, token, observer ) {
    log("C", "INIT", clientName, token);
    const initObserver = this._state.wrap(observer);
    const queued = this._queueObserver(initObserver);
    if (queued) {
      this._packer.packStruct(INIT, [this._packable(clientName), this._packable(token)],
        (err) => this._handleFatalError(err));
      this._chunker.messageBoundary();
      this.sync();
    }
  }

  /** Queue a RUN-message to be sent to the database */
  run( statement, params, observer ) {
    log("C", "RUN", statement, params);
    const queued = this._queueObserver(observer);
    if (queued) {
      this._packer.packStruct(RUN, [this._packable(statement), this._packable(params)],
        (err) => this._handleFatalError(err));
      this._chunker.messageBoundary();
    }
  }

  /** Queue a PULL_ALL-message to be sent to the database */
  pullAll( observer ) {
    log("C", "PULL_ALL");
    const queued = this._queueObserver(observer);
    if (queued) {
      this._packer.packStruct(PULL_ALL, [], (err) => this._handleFatalError(err));
      this._chunker.messageBoundary();
    }
  }

  /** Queue a DISCARD_ALL-message to be sent to the database */
  discardAll( observer ) {
    log("C", "DISCARD_ALL");
    const queued = this._queueObserver(observer);
    if (queued) {
      this._packer.packStruct(DISCARD_ALL, [], (err) => this._handleFatalError(err));
      this._chunker.messageBoundary();
    }
  }

  /**
   * Send a RESET-message to the database. Mutes failure handling.
   * Message is immediately flushed to the network. Separate {@link Connection#sync()} call is not required.
   * @return {Promise<void>} promise resolved when SUCCESS-message response arrives, or failed when other response messages arrives.
   */
  resetAndFlush() {
    log('C', 'RESET');
    this._ackFailureMuted = true;

    return new Promise((resolve, reject) => {
      const observer = {
        onNext: record => {
          const neo4jError = this._handleProtocolError('Received RECORD as a response for RESET: ' + JSON.stringify(record));
          reject(neo4jError);
        },
        onError: error => {
          if (this._isBroken) {
            // handling a fatal error, no need to raise a protocol violation
            reject(error);
          } else {
            const neo4jError = this._handleProtocolError('Received FAILURE as a response for RESET: ' + error);
            reject(neo4jError);
          }
        },
        onCompleted: () => {
          this._ackFailureMuted = false;
          resolve();
        }
      };
      const queued = this._queueObserver(observer);
      if (queued) {
        this._packer.packStruct(RESET, [], err => this._handleFatalError(err));
        this._chunker.messageBoundary();
        this.sync();
      }
    });
  }

  _ackFailureIfNeeded() {
    if (this._ackFailureMuted) {
      return;
    }

    log('C', 'ACK_FAILURE');

    const observer = {
      onNext: record => {
        this._handleProtocolError('Received RECORD as a response for ACK_FAILURE: ' + JSON.stringify(record));
      },
      onError: error => {
        if (!this._isBroken && !this._ackFailureMuted) {
          // not handling a fatal error and RESET did not cause the given error - looks like a protocol violation
          this._handleProtocolError('Received FAILURE as a response for ACK_FAILURE: ' + error);
        } else {
          this._currentFailure = null;
        }
      },
      onCompleted: () => {
        this._currentFailure = null;
      }
    };

    const queued = this._queueObserver(observer);
    if (queued) {
      this._packer.packStruct(ACK_FAILURE, [], err => this._handleFatalError(err));
      this._chunker.messageBoundary();
      this.sync();
    }
  }

  _queueObserver(observer) {
    if( this._isBroken ) {
      if( observer && observer.onError ) {
        observer.onError(this._error);
      }
      return false;
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
    return true;
  }

  /**
   * Get promise resolved when connection initialization succeed or rejected when it fails.
   * Connection is initialized using {@link initialize} function.
   * @return {Promise<Connection>} the result of connection initialization.
   */
  initializationCompleted() {
    return this._state.initializationCompleted();
  }

  /*
   * Pop next pending observer form the list of observers and make it current observer.
   * @protected
   */
  _updateCurrentObserver() {
    this._currentObserver = this._pendingObservers.shift();
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

  isEncrypted() {
    return this._ch.isEncrypted();
  }

  /**
   * Call close on the channel.
   * @param {function} cb - Function to call on close.
   */
  close(cb) {
    this._ch.close(cb);
  }

  _packable(value) {
      return this._packer.packable(value, (err) => this._handleFatalError(err));
  }

  /**
   * @protected
   */
  _markInitialized(metadata) {
    const serverVersion = metadata ? metadata.server : null;
    if (!this.server.version) {
      this.server.version = serverVersion;
      const version = ServerVersion.fromString(serverVersion);
      if (version.compareTo(VERSION_3_2_0) < 0) {
        this._packer.disableByteArrays();
      }
    }
  }

  _handleProtocolError(message) {
    this._ackFailureMuted = false;
    this._currentFailure = null;
    this._updateCurrentObserver();
    const error = newError(message, PROTOCOL_ERROR);
    this._handleFatalError(error);
    return error;
  }
}

class ConnectionState {

  /**
   * @constructor
   * @param {Connection} connection the connection to track state for.
   */
  constructor(connection) {
    this._connection = connection;

    this._initRequested = false;
    this._initError = null;

    this._resolveInitPromise = null;
    this._rejectInitPromise = null;
    this._initPromise = new Promise((resolve, reject) => {
      this._resolveInitPromise = resolve;
      this._rejectInitPromise = reject;
    });
  }

  /**
   * Wrap the given observer to track connection's initialization state. Connection is closed by the server if
   * processing of INIT message fails so returned observer will handle initialization failure as a fatal error.
   * @param {StreamObserver} observer the observer used for INIT message.
   * @return {StreamObserver} updated observer.
   */
  wrap(observer) {
    return {
      onNext: record => {
        if (observer && observer.onNext) {
          observer.onNext(record);
        }
      },
      onError: error => {
        this._processFailure(error);

        this._connection._updateCurrentObserver(); // make sure this same observer will not be called again
        try {
          if (observer && observer.onError) {
            observer.onError(error);
          }
        } finally {
          this._connection._handleFatalError(error);
        }
      },
      onCompleted: metaData => {
        this._connection._markInitialized(metaData);
        this._resolveInitPromise(this._connection);

        if (observer && observer.onCompleted) {
          observer.onCompleted(metaData);
        }
      }
    };
  }

  /**
   * Get promise resolved when connection initialization succeed or rejected when it fails.
   * @return {Promise<Connection>} the result of connection initialization.
   */
  initializationCompleted() {
    this._initRequested = true;

    if (this._initError) {
      const error = this._initError;
      this._initError = null; // to reject initPromise only once
      this._rejectInitPromise(error);
    }

    return this._initPromise;
  }

  /**
   * @private
   */
  _processFailure(error) {
    if (this._initRequested) {
      // someone is waiting for initialization to complete, reject the promise
      this._rejectInitPromise(error);
    } else {
      // no one is waiting for initialization, memorize the error but do not reject the promise
      // to avoid unnecessary unhandled promise rejection warnings
      this._initError = error;
    }
  }
}

/**
 * Crete new connection to the provided address.
 * @access private
 * @param {string} hostPort - the Bolt endpoint to connect to
 * @param {object} config - this driver configuration
 * @param {string=null} connectionErrorCode - error code for errors raised on connection errors
 * @return {Connection} - New connection
 */
function connect(hostPort, config = {}, connectionErrorCode = null) {
  const Ch = config.channel || Channel;
  const parsedAddress = urlUtil.parseDatabaseUrl(hostPort);
  const channelConfig = new ChannelConfig(parsedAddress, config, connectionErrorCode);
  return new Connection(new Ch(channelConfig), parsedAddress.hostAndPort, config.disableLosslessIntegers);
}

export {
  connect,
  Connection
};
