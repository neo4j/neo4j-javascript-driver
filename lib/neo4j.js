/*
 * Copyright (c) 2002-2015 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var connect = require("./internal/connector").connect;
var debug = require("./internal/log").debug;

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
FAILURE = 0x7F,         // 0111 1111 // FAILURE <metadata>

NODE = 0x4E,
RELATIONSHIP = 0x52,
UNBOUND_RELATIONSHIP = 0x72,
PATH = 0x50,

USER_AGENT = "neo4j-javascript/0.0";

function Structure(signature, fields) {
    this.signature = signature;
    this.fields = fields;
}

function Node(identity, labels, properties) {
    this.identity = identity;
    this.labels = labels;
    this.properties = properties;

    this.toString = function toString() {
        var s = "(" + this.identity.split('/')[1];
        for (var i = 0; i < this.labels.length; i++) {
            s += ":" + labels[i];
        }
        var keys = Object.keys(this.properties);
        if (keys.length > 0) {
            s += " {";
            for(var i = 0; i < keys.length; i++) {
                if (i > 0) s += ",";
                s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
            }
            s += "}";
        }
        s += ")";
        return s;
    }
}

function Relationship(identity, start, end, type, properties) {
    this.identity = identity;
    this.start = start;
    this.end = end;
    this.type = type;
    this.properties = properties;

    this.toString = function toString() {
        var s = "(" + this.start.split('/')[1] + ")-[:" + this.type;
        var keys = Object.keys(this.properties);
        if (keys.length > 0) {
            s += " {";
            for(var i = 0; i < keys.length; i++) {
                if (i > 0) s += ",";
                s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
            }
            s += "}";
        }
        s += "]->(" + this.end.split('/')[1] + ")";
        return s;
    }
}

function UnboundRelationship(identity, type, properties) {
    this.identity = identity;
    this.type = type;
    this.properties = properties;

    this.bind = function bind(start, end) {
        return new Relationship(identity, start, end, type, properties);
    }

    this.toString = function toString() {
        var s = "-[:" + this.type;
        var keys = Object.keys(this.properties);
        if (keys.length > 0) {
            s += " {";
            for(var i = 0; i < keys.length; i++) {
                if (i > 0) s += ",";
                s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
            }
            s += "}";
        }
        s += "]->";
        return s;
    }
}

function Path(nodes, rels, sequence) {
    for(var i = 0; i < nodes.length; i++) {
        nodes[i] = hydrate(nodes[i]);
    }
    var last_node = nodes[0],
        entities = [last_node];
    for (var i = 0; i < sequence.length; i += 2) {
        var rel_index = sequence[i],
            next_node = nodes[sequence[i + 1]],
            rel;
        if (rel_index > 0) {
            rel = hydrate(rels[rel_index - 1]);
            entities.push(rel.bind(last_node.identity, next_node.identity));
        } else {
            rel = hydrate(rels[-rel_index - 1]);
            entities.push(rel.bind(next_node.identity, last_node.identity));
        }
        entities.push(next_node);
        last_node = next_node;
    }

    this.nodes = [entities[0]];
    this.relationships = [];
    for (var i = 1; i < entities.length; i++) {
        if (i % 2 == 0) {
            this.nodes.push(entities[i]);
        } else {
            this.relationships.push(entities[i]);
        }
    }

    this.toString = function toString() {
        return "<Path>";
    }
}

function hydrate(x) {
    if (Array.isArray(x)) {
        for (var i = 0; i < x.length; i++) {
            x[i] = hydrate(x[i]);
        }
    } else if (x instanceof Structure) {
        fields = x.fields;
        switch(x.signature) {
            case NODE:
                x = new Node(fields[0], fields[1], fields[2]);
                break;
            case RELATIONSHIP:
                x = new Relationship(fields[0], fields[1], fields[2], fields[3], fields[4]);
                break;
            case UNBOUND_RELATIONSHIP:
                x = new UnboundRelationship(fields[0], fields[1], fields[2]);
                break;
            case PATH:
                x = new Path(fields[0], fields[1], fields[2]);
                break;
        }
    }
    return x;
}

function RunRequest(statement, parameters, onHeader, onRecord, onFooter) {
    this.statement = statement;
    this.parameters = parameters;
    this.onHeader = onHeader;
    this.onRecord = onRecord;
    this.onFooter = onFooter;
}

function ProtocolError(msg) {
    this.message = msg;
}

function ResponseHandler(summaryHandler, detailHandler) {
    this.summaryHandler = summaryHandler;
    this.detailHandler = detailHandler;
}

function Message(ws) {
    var data = [],
        size = 0;

    function flush() {
        var header = new Uint8Array([size/256>>0, size%256]);
        ws.send(header);
        for(var i = 0; i < data.length; i++) {
            ws.send(data[i]);
        }
        data = [];
        size = 0;
    }

    this.write = function write(b) {
        // TODO: when b > MAX_CHUNK_SIZE
        var newSize = size + b.length;
        if (newSize >= MAX_CHUNK_SIZE) {
            flush();
        }
        data.push(b);
        size += b.length;
    }

    this.end = function end() {
        flush();
        var zero = new Uint8Array([0, 0]);
        ws.send(zero);
    }

}

function Session( conn ) {
    var receiver = null,
        responseHandlers = [],
        ready = false,
        requests = [];

    this._conn = conn;

    function handshake() {
        debug("C: [HANDSHAKE] [1, 0, 0, 0]");
        receiver = function(data) {
            var version = new DataView(data).getUint32(0);
            debug("S: [HANDSHAKE] " + version);
            if (version == 1) {
                receiver = receiverV1;
                init();
            } else {
                throw new ProtocolError("Unknown protocol version: " + version);
            }
        }
        ws.send(new Uint8Array([0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0]));
    }

    function send(signature, fields, summaryHandler, detailHandler) {
        responseHandlers.push(new ResponseHandler(summaryHandler, detailHandler));
        packer.pack(new Structure(signature, fields));
        msg.end();
    }

    function recv(data) {
        var b = new Uint8Array(data), h = [];
        for(var i = 0; i < b.length; i++) {
            h.push((b[i] < 0x10 ? "0" : "") + b[i].toString(16).toUpperCase());
        }
        //debug("S: " + h.join(" "));
        if (receiver) receiver(data);
    }

    function onMessage(data) {
        var unpacker = new Unpacker(data),
            message = unpacker.unpack();
        switch(message.signature) {
            case SUCCESS:
                debug("S: SUCCESS " + JSON.stringify(message.fields[0]));
                var handler = responseHandlers.shift().summaryHandler;
                if(handler) handler(true, message.fields[0]);
                break;
            case FAILURE:
                debug("S: FAILURE " + JSON.stringify(message.fields[0]));
                console.log(message.fields[0]);
                var handler = responseHandlers.shift().summaryHandler;
                if(handler) handler(false, message.fields[0]);
                debug("C: ACK_FAILURE");
                responseHandlers.unshift(new ResponseHandler());
                packer.pack(new Structure(ACK_FAILURE, []));
                msg.end();
                break;
            case IGNORED:
                debug("S: IGNORED");
                responseHandlers.shift();
                break;
            case RECORD:
                debug("S: RECORD " + JSON.stringify(message.fields[0]));
                var handler = responseHandlers[0].detailHandler;
                if(handler) handler(hydrate(message.fields[0]));
                break;
            default:
                debug("WTF");
        }
    }

    var messageData = new Uint8Array();
    function onChunk(data) {
        if (data.length == 0) {
            onMessage(messageData);
            messageData = new Uint8Array();
        } else {
            var newData = new Uint8Array(messageData.length + data.length);
            newData.set(messageData);
            newData.set(data, messageData.length);
            messageData = newData;
        }
    }

    function receiverV1(data) {
        var p = 0;
        while (p < data.byteLength) {
            var q = p + 2,
                chunkSize = new DataView(data.slice(p, q)).getUint16(0);
            p = q + chunkSize;
            onChunk(new Uint8Array(data.slice(q, p)));
        }

    }

    function init() {
        debug("C: INIT " + JSON.stringify(USER_AGENT));
        send(INIT, [USER_AGENT], function(success) {
            if(success) {
                ready = true;
                runNext();
            }
        });
    }

    this.run = function run(statement, parameters, onRecord, onHeader, onFooter) {
        requests.push(new RunRequest(statement, parameters, onHeader, onRecord, onFooter));
        runNext();
    }

    function runNext() {
        if (ready) {
            while (requests.length > 0) {
                var rq = requests.shift();
                if (rq instanceof RunRequest) {
                    ready = false;
                    debug("C: RUN " + JSON.stringify(rq.statement) + " " + JSON.stringify(rq.parameters));
                    send(RUN, [rq.statement, rq.parameters], rq.onHeader);
                    debug("C: PULL_ALL");
                    send(PULL_ALL, [], function(metadata) {
                        if (rq.onFooter) rq.onFooter(metadata);
                        ready = true;
                    }, rq.onRecord);
                } else {
                    debug("UNKNOWN REQUEST TYPE");
                }
            }
        }
    }
}

function Driver(url) {
    this._url = url;
}

Driver.prototype.session = function() {
    return new Session( this._url );
}

function driver(url) {
    return {
        "session" : function() {
            return new Session( connect(url) );
        }
    }
}

// Expose public classes
module.exports = {
    "Session": Session,
    "Node": Node,
    "Relationship": Relationship,
    "Path": Path,
    "driver": driver
};
