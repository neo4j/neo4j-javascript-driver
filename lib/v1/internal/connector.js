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

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _chWebsocket = require("./ch-websocket");

var _chWebsocket2 = _interopRequireDefault(_chWebsocket);

var _chNode = require("./ch-node");

var _chNode2 = _interopRequireDefault(_chNode);

var _chunking = require("./chunking");

var _chunking2 = _interopRequireDefault(_chunking);

var _features = require("./features");

var _features2 = _interopRequireDefault(_features);

var _packstream = require("./packstream");

var _packstream2 = _interopRequireDefault(_packstream);

var _buf = require("./buf");

var _graphTypes = require('../graph-types');

var _graphTypes2 = _interopRequireDefault(_graphTypes);

var _integer = require('../integer');

var _error = require('./../error');

var Channel = undefined;
if (_chWebsocket2["default"].available) {
  Channel = _chWebsocket2["default"].channel;
} else if (_chNode2["default"].available) {
  Channel = _chNode2["default"].channel;
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
MAGIC_PREAMBLE = 0x6060B017;

var URLREGEX = new RegExp(["[^/]+//", // scheme
"(([^:/?#]*)", // hostname
"(?::([0-9]+))?)", // port (optional)
".*"].join("")); // everything else

function host(url) {
  return url.match(URLREGEX)[2];
}

function port(url) {
  return url.match(URLREGEX)[3];
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
    return new _graphTypes2["default"].Node(unpacker.unpack(buf), // Identity
    unpacker.unpack(buf), // Labels
    unpacker.unpack(buf) // Properties
    );
  },
  rel: function rel(unpacker, buf) {
    return new _graphTypes2["default"].Relationship(unpacker.unpack(buf), // Identity
    unpacker.unpack(buf), // Start Node Identity
    unpacker.unpack(buf), // End Node Identity
    unpacker.unpack(buf), // Type
    unpacker.unpack(buf) // Properties
    );
  },
  unboundRel: function unboundRel(unpacker, buf) {
    return new _graphTypes2["default"].UnboundRelationship(unpacker.unpack(buf), // Identity
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
          rel = undefined;
      if (relIndex > 0) {
        rel = rels[relIndex - 1];
        if (rel instanceof _graphTypes2["default"].UnboundRelationship) {
          // To avoid duplication, relationships in a path do not contain
          // information about their start and end nodes, that's instead
          // inferred from the path sequence. This is us inferring (and,
          // for performance reasons remembering) the start/end of a rel.
          rels[relIndex - 1] = rel = rel.bind(prevNode.identity, nextNode.identity);
        }
      } else {
        rel = rels[-relIndex - 1];
        if (rel instanceof _graphTypes2["default"].UnboundRelationship) {
          // See above
          rels[-relIndex - 1] = rel = rel.bind(nextNode.identity, prevNode.identity);
        }
      }
      // Done hydrating one path segment.
      segments.push(new _graphTypes2["default"].PathSegment(prevNode, rel, nextNode));
      prevNode = nextNode;
    }
    return new _graphTypes2["default"].Path(nodes[0], nodes[nodes.length - 1], segments);
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

var Connection = (function () {

  /**
   * @constructor
   * @param channel - channel with a 'write' function and a 'onmessage'
   *                  callback property
   */

  function Connection(channel) {
    _classCallCheck(this, Connection);

    /**
     * An ordered queue of observers, each exchange response (zero or more
     * RECORD messages followed by a SUCCESS message) we recieve will be routed
     * to the next pending observer.
     */
    this._pendingObservers = [];
    this._currentObserver = undefined;
    this._ch = channel;
    this._dechunker = new _chunking2["default"].Dechunker();
    this._chunker = new _chunking2["default"].Chunker(channel);
    this._packer = new _packstream2["default"].Packer(this._chunker);
    this._unpacker = new _packstream2["default"].Unpacker();
    this._isHandlingFailure = false;

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
   * Crete new connection to the provided url.
   * @access private
   * @param {string} url - 'neo4j'-prefixed URL to Neo4j Bolt endpoint
   * @param {object} config
   * @return {Connection} - New connection
   */

  /**
   * "Fatal" means the connection is dead. Only call this if something
   * happens that cannot be recovered from. This will lead to all subscribers
   * failing, and the connection getting ejected from the session pool.
   *
   * @param err an error object, forwarded to all current and future subscribers
   * @private
   */

  _createClass(Connection, [{
    key: "_handleFatalError",
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
    key: "_handleMessage",
    value: function _handleMessage(msg) {
      var _this = this;

      switch (msg.signature) {
        case RECORD:
          this._currentObserver.onNext(msg.fields[0]);
          break;
        case SUCCESS:
          try {
            this._currentObserver.onCompleted(msg.fields[0]);
          } finally {
            this._currentObserver = this._pendingObservers.shift();
          }
          break;
        case FAILURE:
          try {
            this._currentObserver.onError(msg);
            this._errorMsg = msg;
          } finally {
            this._currentObserver = this._pendingObservers.shift();
            // Things are now broken. Pending observers will get FAILURE messages routed until
            // We are done handling this failure.
            if (!this._isHandlingFailure) {
              (function () {
                _this._isHandlingFailure = true;
                var self = _this;

                // isHandlingFailure was false, meaning this is the first failure message
                // we see from this failure. We may see several others, one for each message
                // we had "optimistically" already sent after whatever it was that failed.
                // We only want to and need to ACK the first one, which is why we are tracking
                // this _isHandlingFailure thing.
                _this._ackFailure({
                  onNext: NO_OP,
                  onError: NO_OP,
                  onCompleted: function onCompleted() {
                    self._isHandlingFailure = false;
                  }
                });
              })();
            }
          }
          break;
        case IGNORED:
          try {
            if (this._errorMsg && this._currentObserver.onError) this._currentObserver.onError(this._errorMsg);else if (this._currentObserver.onError) this._currentObserver.onError(msg);
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
    key: "initialize",
    value: function initialize(clientName, token, observer) {
      var _this2 = this;

      this._queueObserver(observer);
      this._packer.packStruct(INIT, [this._packable(clientName), this._packable(token)], function (err) {
        return _this2._handleFatalError(err);
      });
      this._chunker.messageBoundary();
      this.sync();
    }

    /** Queue a RUN-message to be sent to the database */
  }, {
    key: "run",
    value: function run(statement, params, observer) {
      var _this3 = this;

      this._queueObserver(observer);
      this._packer.packStruct(RUN, [this._packable(statement), this._packable(params)], function (err) {
        return _this3._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a PULL_ALL-message to be sent to the database */
  }, {
    key: "pullAll",
    value: function pullAll(observer) {
      var _this4 = this;

      this._queueObserver(observer);
      this._packer.packStruct(PULL_ALL, [], function (err) {
        return _this4._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a DISCARD_ALL-message to be sent to the database */
  }, {
    key: "discardAll",
    value: function discardAll(observer) {
      var _this5 = this;

      this._queueObserver(observer);
      this._packer.packStruct(DISCARD_ALL, [], function (err) {
        return _this5._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }

    /** Queue a RESET-message to be sent to the database */
  }, {
    key: "reset",
    value: function reset(observer) {
      var _this6 = this;

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

    /** Queue a ACK_FAILURE-message to be sent to the database */
  }, {
    key: "_ackFailure",
    value: function _ackFailure(observer) {
      var _this7 = this;

      this._queueObserver(observer);
      this._packer.packStruct(ACK_FAILURE, [], function (err) {
        return _this7._handleFatalError(err);
      });
      this._chunker.messageBoundary();
    }
  }, {
    key: "_queueObserver",
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
    key: "sync",
    value: function sync() {
      this._chunker.flush();
    }

    /** Check if this connection is in working condition */
  }, {
    key: "isOpen",
    value: function isOpen() {
      return !this._isBroken && this._ch._open;
    }

    /**
     * Call close on the channel.
     * @param {function} cb - Function to call on close.
     */
  }, {
    key: "close",
    value: function close(cb) {
      this._ch.close(cb);
    }
  }, {
    key: "_packable",
    value: function _packable(value) {
      var _this8 = this;

      return this._packer.packable(value, function (err) {
        return _this8._handleFatalError(err);
      });
    }
  }]);

  return Connection;
})();

function connect(url) {
  var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var Ch = config.channel || Channel;
  return new Connection(new Ch({
    host: host(url),
    port: port(url) || 7687,
    // Default to using encryption if trust-on-first-use is available
    encrypted: config.encrypted == null ? (0, _features2["default"])("trust_on_first_use") : config.encrypted,
    // Default to using trust-on-first-use if it is available
    trust: config.trust || ((0, _features2["default"])("trust_on_first_use") ? "TRUST_ON_FIRST_USE" : "TRUST_SIGNED_CERTIFICATES"),
    trustedCertificates: config.trustedCertificates || [],
    knownHosts: config.knownHosts
  }));
}

exports["default"] = {
  connect: connect,
  Connection: Connection
};
module.exports = exports["default"];