'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Connection = exports.parsePort = exports.parseHost = exports.parseUrl = exports.parseScheme = exports.connect = undefined;

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _chWebsocket = require('./ch-websocket');

var _chWebsocket2 = _interopRequireDefault(_chWebsocket);

var _chNode = require('./ch-node');

var _chNode2 = _interopRequireDefault(_chNode);

var _chunking = require('./chunking');

var _features = require('./features');

var _features2 = _interopRequireDefault(_features);

var _packstream = require('./packstream');

var _buf = require('./buf');

var _graphTypes = require('../graph-types');

var _error = require('./../error');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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
var Channel = void 0;
if (_chNode2.default.available) {
  Channel = _chNode2.default.channel;
} else if (_chWebsocket2.default.available) {
  Channel = _chWebsocket2.default.channel;
} else {
  throw (0, _error.newError)("Fatal: No compatible transport available. Need to run on a platform with the WebSocket API.");
}

var
// Signature bytes for each message type
INIT = 0x01,
    // 0000 0001 // INIT <user_agent>
ACK_FAILURE = 0x0E,
    // 0000 1110 // ACK_FAILURE
RESET = 0x0F,
    // 0000 1111 // RESET
RUN = 0x10,
    // 0001 0000 // RUN <statement> <parameters>
DISCARD_ALL = 0x2F,
    // 0010 1111 // DISCARD *
PULL_ALL = 0x3F,
    // 0011 1111 // PULL *
SUCCESS = 0x70,
    // 0111 0000 // SUCCESS <metadata>
RECORD = 0x71,
    // 0111 0001 // RECORD <value>
IGNORED = 0x7E,
    // 0111 1110 // IGNORED <metadata>
FAILURE = 0x7F,
    // 0111 1111 // FAILURE <metadata>

// Signature bytes for higher-level graph objects
NODE = 0x4E,
    RELATIONSHIP = 0x52,
    UNBOUND_RELATIONSHIP = 0x72,
    PATH = 0x50,

//sent before version negotiation
MAGIC_PREAMBLE = 0x6060B017,
    DEBUG = false;

var URLREGEX = new RegExp(["([^/]+//)?", // scheme
"(([^:/?#]*)", // hostname
"(?::([0-9]+))?)", // port (optional)
".*"].join("")); // everything else

function parseScheme(url) {
  var scheme = url.match(URLREGEX)[1] || '';
  return scheme.toLowerCase();
}

function parseUrl(url) {
  return url.match(URLREGEX)[2];
}

function parseHost(url) {
  return url.match(URLREGEX)[3];
}

function parsePort(url) {
  return url.match(URLREGEX)[4];
}

/**
 * Very rudimentary log handling, should probably be replaced by something proper at some point.
 * @param actor the part that sent the message, 'S' for server and 'C' for client
 * @param msg the bolt message
 */
function log(actor, msg) {
  if (DEBUG) {
    for (var i = 2; i < arguments.length; i++) {
      msg += " " + (0, _stringify2.default)(arguments[i]);
    }
    console.log(actor + ":" + msg);
  }
}

function NO_OP() {}

var NO_OP_OBSERVER = {
  onNext: NO_OP,
  onCompleted: NO_OP,
  onError: NO_OP
};

/** Maps from packstream structures to Neo4j domain objects */
var _mappers = {
  node: function node(unpacker, buf) {
    return new _graphTypes.Node(unpacker.unpack(buf), // Identity
    unpacker.unpack(buf), // Labels
    unpacker.unpack(buf) // Properties
    );
  },
  rel: function rel(unpacker, buf) {
    return new _graphTypes.Relationship(unpacker.unpack(buf), // Identity
    unpacker.unpack(buf), // Start Node Identity
    unpacker.unpack(buf), // End Node Identity
    unpacker.unpack(buf), // Type
    unpacker.unpack(buf) // Properties
    );
  },
  unboundRel: function unboundRel(unpacker, buf) {
    return new _graphTypes.UnboundRelationship(unpacker.unpack(buf), // Identity
    unpacker.unpack(buf), // Type
    unpacker.unpack(buf) // Properties
    );
  },
  path: function path(unpacker, buf) {
    var nodes = unpacker.unpack(buf),
        rels = unpacker.unpack(buf),
        sequence = unpacker.unpack(buf);
    var prevNode = nodes[0],
        segments = [];

    for (var i = 0; i < sequence.length; i += 2) {
      var relIndex = sequence[i],
          nextNode = nodes[sequence[i + 1]],
          rel = void 0;
      if (relIndex > 0) {
        rel = rels[relIndex - 1];
        if (rel instanceof _graphTypes.UnboundRelationship) {
          // To avoid duplication, relationships in a path do not contain
          // information about their start and end nodes, that's instead
          // inferred from the path sequence. This is us inferring (and,
          // for performance reasons remembering) the start/end of a rel.
          rels[relIndex - 1] = rel = rel.bind(prevNode.identity, nextNode.identity);
        }
      } else {
        rel = rels[-relIndex - 1];
        if (rel instanceof _graphTypes.UnboundRelationship) {
          // See above
          rels[-relIndex - 1] = rel = rel.bind(nextNode.identity, prevNode.identity);
        }
      }
      // Done hydrating one path segment.
      segments.push(new _graphTypes.PathSegment(prevNode, rel, nextNode));
      prevNode = nextNode;
    }
    return new _graphTypes.Path(nodes[0], nodes[nodes.length - 1], segments);
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

var Connection = function () {

  /**
   * @constructor
   * @param channel - channel with a 'write' function and a 'onmessage'
   *                  callback property
   * @param url - url to connect to
   */
  function Connection(channel, url) {
    (0, _classCallCheck3.default)(this, Connection);

    /**
     * An ordered queue of observers, each exchange response (zero or more
     * RECORD messages followed by a SUCCESS message) we recieve will be routed
     * to the next pending observer.
     */
    this.url = url;
    this.server = { address: url };
    this._pendingObservers = [];
    this._currentObserver = undefined;
    this._ch = channel;
    this._dechunker = new _chunking.Dechunker();
    this._chunker = new _chunking.Chunker(channel);
    this._packer = new _packstream.Packer(this._chunker);
    this._unpacker = new _packstream.Unpacker();

    this._isHandlingFailure = false;
    this._currentFailure = null;

    // Set to true on fatal errors, to get this out of session pool.
    this._isBroken = false;

    // For deserialization, explain to the unpacker how to unpack nodes, rels, paths;
    this._unpacker.structMappers[NODE] = _mappers.node;
    this._unpacker.structMappers[RELATIONSHIP] = _mappers.rel;
    this._unpacker.structMappers[UNBOUND_RELATIONSHIP] = _mappers.unboundRel;
    this._unpacker.structMappers[PATH] = _mappers.path;

    var self = this;
    // TODO: Using `onmessage` and `onerror` came from the WebSocket API,
    // it reads poorly and has several annoying drawbacks. Swap to having
    // Channel extend EventEmitter instead, then we can use `on('data',..)`
    this._ch.onmessage = function (buf) {
      var proposed = buf.readInt32();
      if (proposed == 1) {
        // Ok, protocol running. Simply forward all messages past
        // this to the dechunker
        self._ch.onmessage = function (buf) {
          self._dechunker.write(buf);
        };

        if (buf.hasRemaining()) {
          self._dechunker.write(buf.readSlice(buf.remaining()));
        }
      } else if (proposed == 1213486160) {
        //server responded 1213486160 == 0x48545450 == "HTTP"
        self._handleFatalError((0, _error.newError)("Server responded HTTP. Make sure you are not trying to connect to the http endpoint " + "(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)"));
      } else {
        self._handleFatalError((0, _error.newError)("Unknown Bolt protocol version: " + proposed));
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
    if (this._ch._error) {
      this._handleFatalError(this._ch._error);
    }

    this._dechunker.onmessage = function (buf) {
      self._handleMessage(self._unpacker.unpack(buf));
    };

    var handshake = (0, _buf.alloc)(5 * 4);
    //magic preamble
    handshake.writeInt32(MAGIC_PREAMBLE);
    //proposed versions
    handshake.writeInt32(1);
    handshake.writeInt32(0);
    handshake.writeInt32(0);
    handshake.writeInt32(0);
    handshake.reset();
    this._ch.write(handshake);
  }

  /**
   * "Fatal" means the connection is dead. Only call this if something
   * happens that cannot be recovered from. This will lead to all subscribers
   * failing, and the connection getting ejected from the session pool.
   *
   * @param err an error object, forwarded to all current and future subscribers
   * @private
   */


  (0, _createClass3.default)(Connection, [{
    key: '_handleFatalError',
    value: function _handleFatalError(err) {
      this._isBroken = true;
      this._error = err;
      if (this._currentObserver && this._currentObserver.onError) {
        this._currentObserver.onError(err);
      }
      while (this._pendingObservers.length > 0) {
        var observer = this._pendingObservers.shift();
        if (observer && observer.onError) {
          observer.onError(err);
        }
      }
    }
  }, {
    key: '_handleMessage',
    value: function _handleMessage(msg) {
      var _this = this;

      var payload = msg.fields[0];

      switch (msg.signature) {
        case RECORD:
          log("S", "RECORD", msg);
          this._currentObserver.onNext(payload);
          break;
        case SUCCESS:
          log("S", "SUCCESS", msg);
          try {
            this._currentObserver.onCompleted(payload);
          } finally {
            this._currentObserver = this._pendingObservers.shift();
          }
          break;
        case FAILURE:
          log("S", "FAILURE", msg);
          try {
            this._currentFailure = (0, _error.newError)(payload.message, payload.code);
            this._currentObserver.onError(this._currentFailure);
          } finally {
            this._currentObserver = this._pendingObservers.shift();
            // Things are now broken. Pending observers will get FAILURE messages routed until
            // We are done handling this failure.
            if (!this._isHandlingFailure) {
              this._isHandlingFailure = true;

              // isHandlingFailure was false, meaning this is the first failure message
              // we see from this failure. We may see several others, one for each message
              // we had "optimistically" already sent after whatever it was that failed.
              // We only want to and need to ACK the first one, which is why we are tracking
              // this _isHandlingFailure thing.
              this._ackFailure({
                onNext: NO_OP,
                onError: NO_OP,
                onCompleted: function onCompleted() {
                  _this._isHandlingFailure = false;
                  _this._currentFailure = null;
                }
              });
            }
          }
          break;
        case IGNORED:
          log("S", "IGNORED", msg);
          try {
            if (this._currentFailure && this._currentObserver.onError) this._currentObserver.onError(this._currentFailure);else if (this._currentObserver.onError) this._currentObserver.onError(payload);
          } finally {
            this._currentObserver = this._pendingObservers.shift();
          }
          break;
        default:
          this._handleFatalError((0, _error.newError)("Unknown Bolt protocol message: " + msg));
      }
    }

    /** Queue an INIT-message to be sent to the database */

  }, {
    key: 'initialize',
    value: function initialize(clientName, token, observer) {
      var _this2 = this;

      log("C", "INIT", clientName, token);
      this._queueObserver(observer);
      this._packer.packStruct(INIT, [this._packable(clientName), this._packable(token)], function (err) {
        return _this2._handleFatalError(err);
      });
      this._chunker.messageBoundary();
      this.sync();
    }

    /** Queue a RUN-message to be sent to the database */

  }, {
    key: 'run',
    value: function run(statement, params, observer) {
      var _this3 = this;

      log("C", "RUN", statement, params);
      this._queueObserver(observer);
      this._packer.packStruct(RUN, [this._packable(statement), this._packable(params)], function (err) {
        return _this3._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a PULL_ALL-message to be sent to the database */

  }, {
    key: 'pullAll',
    value: function pullAll(observer) {
      var _this4 = this;

      log("C", "PULL_ALL");
      this._queueObserver(observer);
      this._packer.packStruct(PULL_ALL, [], function (err) {
        return _this4._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a DISCARD_ALL-message to be sent to the database */

  }, {
    key: 'discardAll',
    value: function discardAll(observer) {
      var _this5 = this;

      log("C", "DISCARD_ALL");
      this._queueObserver(observer);
      this._packer.packStruct(DISCARD_ALL, [], function (err) {
        return _this5._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a RESET-message to be sent to the database. Mutes failure handling. */

  }, {
    key: 'resetAsync',
    value: function resetAsync(observer) {
      var _this6 = this;

      log("C", "RESET_ASYNC");
      this._isHandlingFailure = true;
      var self = this;
      var wrappedObs = {
        onNext: observer ? observer.onNext : NO_OP,
        onError: observer ? observer.onError : NO_OP,
        onCompleted: function onCompleted() {
          self._isHandlingFailure = false;
          if (observer) {
            observer.onCompleted();
          }
        }
      };
      this._queueObserver(wrappedObs);
      this._packer.packStruct(RESET, [], function (err) {
        return _this6._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a RESET-message to be sent to the database */

  }, {
    key: 'reset',
    value: function reset(observer) {
      var _this7 = this;

      log('C', 'RESET');
      this._queueObserver(observer);
      this._packer.packStruct(RESET, [], function (err) {
        return _this7._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a ACK_FAILURE-message to be sent to the database */

  }, {
    key: '_ackFailure',
    value: function _ackFailure(observer) {
      var _this8 = this;

      log("C", "ACK_FAILURE");
      this._queueObserver(observer);
      this._packer.packStruct(ACK_FAILURE, [], function (err) {
        return _this8._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }
  }, {
    key: '_queueObserver',
    value: function _queueObserver(observer) {
      if (this._isBroken) {
        if (observer && observer.onError) {
          observer.onError(this._error);
        }
        return;
      }
      observer = observer || NO_OP_OBSERVER;
      observer.onCompleted = observer.onCompleted || NO_OP;
      observer.onError = observer.onError || NO_OP;
      observer.onNext = observer.onNext || NO_OP;
      if (this._currentObserver === undefined) {
        this._currentObserver = observer;
      } else {
        this._pendingObservers.push(observer);
      }
    }

    /**
     * Synchronize - flush all queued outgoing messages and route their responses
     * to their respective handlers.
     */

  }, {
    key: 'sync',
    value: function sync() {
      this._chunker.flush();
    }

    /** Check if this connection is in working condition */

  }, {
    key: 'isOpen',
    value: function isOpen() {
      return !this._isBroken && this._ch._open;
    }
  }, {
    key: 'isEncrypted',
    value: function isEncrypted() {
      return this._ch.isEncrypted();
    }

    /**
     * Call close on the channel.
     * @param {function} cb - Function to call on close.
     */

  }, {
    key: 'close',
    value: function close(cb) {
      this._ch.close(cb);
    }
  }, {
    key: '_packable',
    value: function _packable(value) {
      var _this9 = this;

      return this._packer.packable(value, function (err) {
        return _this9._handleFatalError(err);
      });
    }
  }, {
    key: 'setServerVersion',
    value: function setServerVersion(version) {
      this.server.version = version;
    }
  }]);
  return Connection;
}();

/**
 * Crete new connection to the provided url.
 * @access private
 * @param {string} url - 'neo4j'-prefixed URL to Neo4j Bolt endpoint
 * @param {object} config
 * @return {Connection} - New connection
 */


function connect(url) {
  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var Ch = config.channel || Channel;
  var host = parseHost(url);
  var port = parsePort(url) || 7687;
  var completeUrl = host + ':' + port;

  return new Connection(new Ch({
    host: parseHost(url),
    port: parsePort(url) || 7687,
    // Default to using encryption if trust-on-first-use is available
    encrypted: config.encrypted == null ? (0, _features2.default)("trust_all_certificates") : config.encrypted,
    // Default to using TRUST_ALL_CERTIFICATES if it is available
    trust: config.trust || ((0, _features2.default)("trust_all_certificates") ? "TRUST_ALL_CERTIFICATES" : "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES"),
    trustedCertificates: config.trustedCertificates || [],
    knownHosts: config.knownHosts
  }), completeUrl);
}

exports.connect = connect;
exports.parseScheme = parseScheme;
exports.parseUrl = parseUrl;
exports.parseHost = parseHost;
exports.parsePort = parsePort;
exports.Connection = Connection;