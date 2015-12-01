/**
 * Copyright (c) 2002-2015 "Neo Technology,"
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

var _packstream = require("./packstream");

var _packstream2 = _interopRequireDefault(_packstream);

var _buf = require("./buf");

var _graphTypes = require('../graph-types');

var _graphTypes2 = _interopRequireDefault(_graphTypes);

var _integer = require('../integer');

var Channel = undefined;
if (_chWebsocket2["default"].available) {
  Channel = _chWebsocket2["default"].channel;
} else if (_chNode2["default"].available) {
  Channel = _chNode2["default"].channel;
} else {
  throw new Error("Fatal: No compatible transport available. Need to run on a platform with the WebSocket API.");
}

var
// Signature bytes for each message type
INIT = 0x01,
    // 0000 0001 // INIT <user_agent>
ACK_FAILURE = 0x0F,
    // 0000 1111 // ACK_FAILURE
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
    PATH = 0x50;

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

function NO_OP() {};

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
    return new _graphTypes2["default"].Path(segments);
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

    // For deserialization, explain to the unpacker how to unpack nodes, rels, paths;
    this._unpacker.structMappers[NODE] = _mappers.node;
    this._unpacker.structMappers[RELATIONSHIP] = _mappers.rel;
    this._unpacker.structMappers[UNBOUND_RELATIONSHIP] = _mappers.unboundRel;
    this._unpacker.structMappers[PATH] = _mappers.path;

    var self = this;
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
      } else {
        // TODO: Report error
        console.log("FATAL, unknown protocol version:", proposed);
      }
    };

    this._dechunker.onmessage = function (buf) {
      self._handleMessage(self._unpacker.unpack(buf));
    };

    var version_proposal = (0, _buf.alloc)(4 * 4);
    version_proposal.writeInt32(1);
    version_proposal.writeInt32(0);
    version_proposal.writeInt32(0);
    version_proposal.writeInt32(0);
    version_proposal.reset();
    this._ch.write(version_proposal);
  }

  /**
   * Crete new connection to the provided url.
   * @access private
   * @param {string} url - 'neo4j'-prefixed URL to Neo4j Bolt endpoint
   * @return {Connection} - New connection
   */

  _createClass(Connection, [{
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
      }
    }

    /** Queue an INIT-message to be sent to the database */
  }, {
    key: "initialize",
    value: function initialize(clientName, observer) {
      this._queueObserver(observer);
      this._packer.packStruct(INIT, [clientName]);
      this._chunker.messageBoundary();
    }

    /** Queue a RUN-message to be sent to the database */
  }, {
    key: "run",
    value: function run(statement, params, observer) {
      this._queueObserver(observer);
      this._packer.packStruct(RUN, [statement, params]);
      this._chunker.messageBoundary();
    }

    /** Queue a PULL_ALL-message to be sent to the database */
  }, {
    key: "pullAll",
    value: function pullAll(observer) {
      this._queueObserver(observer);
      this._packer.packStruct(PULL_ALL);
      this._chunker.messageBoundary();
    }

    /** Queue a DISCARD_ALL-message to be sent to the database */
  }, {
    key: "discardAll",
    value: function discardAll(observer) {
      this._queueObserver(observer);
      this._packer.packStruct(DISCARD_ALL);
      this._chunker.messageBoundary();
    }

    /** Queue a ACK_FAILURE-message to be sent to the database */
  }, {
    key: "_ackFailure",
    value: function _ackFailure(observer) {
      this._queueObserver(observer);
      this._packer.packStruct(ACK_FAILURE);
      this._chunker.messageBoundary();
    }
  }, {
    key: "_queueObserver",
    value: function _queueObserver(observer) {
      observer = observer || NO_OP_OBSERVER;
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

    /**
     * Call close on the channel.
     * @param {function} cb - Function to call on close.
     */
  }, {
    key: "close",
    value: function close(cb) {
      this._ch.close(cb);
    }
  }]);

  return Connection;
})();

function connect(url) {
  return new Connection(new Channel({
    host: host(url),
    port: port(url)
  }));
}

exports["default"] = {
  connect: connect,
  Connection: Connection
};
module.exports = exports["default"];