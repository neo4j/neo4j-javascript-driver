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

(function() {

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

        TINY_TEXT = 0x80,
        TINY_LIST = 0x90,
        TINY_MAP = 0xA0,
        TINY_STRUCT = 0xB0,
        NULL = 0xC0,
        FLOAT_64 = 0xC1,
        FALSE = 0xC2,
        TRUE = 0xC3,
        INT_8 = 0xC8,
        INT_16 = 0xC9,
        INT_32 = 0xCA,
        INT_64 = 0xCB,
        TEXT_8 = 0xD0,
        TEXT_16 = 0xD1,
        TEXT_32 = 0xD2,
        LIST_8 = 0xD4,
        LIST_16 = 0xD5,
        LIST_32 = 0xD6,
        MAP_8 = 0xD8,
        MAP_16 = 0xD9,
        MAP_32 = 0xDA,
        STRUCT_8 = 0xDC,
        STRUCT_16 = 0xDD,

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

    function Packer(msg) {

        var encoder = new TextEncoder();

        this.pack = function pack(x) {
            if (x === null) {
                packNull();
            } else if (x === true) {
                packTrue();
            } else if (x === false) {
                packFalse();
            } else if (typeof(x) == "number") {
                packNumber(x);
            } else if (typeof(x) == "string") {
                packText(x);
            } else if (x instanceof Array) {
                packListHeader(x.length);
                for(var i = 0; i < x.length; i++)
                    pack(x[i]);
            } else if (x instanceof Structure) {
                packStructHeader(x.fields.length, x.signature);
                for(var i = 0; i < x.fields.length; i++)
                    pack(x.fields[i]);
            } else if (typeof(x) == "object") {
                var keys = Object.keys(x);
                packMapHeader(keys.length);
                for(var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    packText(key);
                    pack(x[key]);
                }
            } else {
                // TODO
                console.log(x);
            }
        }

        function packNull() {
            msg.write(new Uint8Array([NULL]));
        }

        function packTrue() {
            msg.write(new Uint8Array([TRUE]));
        }

        function packFalse() {
            msg.write(new Uint8Array([FALSE]));
        }

        function packNumber(x) {
            if (x == x>>0)
                packInteger(x);
            else
                packFloat(x);
        }

        function packInteger(x) {
            if (-0x10 <= x && x < 0x80) {
                var a = new Uint8Array(1);
                new DataView(a.buffer).setInt8(0, x);
                msg.write(a);
            } else if (-0x80 <= x && x < -0x10) {
                var a = new Uint8Array(2);
                a[0] = INT_8;
                new DataView(a.buffer).setInt8(1, x);
                msg.write(a);
            } else if (-0x8000 <= x && x < 0x8000) {
                var a = new Uint8Array(3);
                a[0] = INT_16;
                new DataView(a.buffer).setInt16(1, x);
                msg.write(a);
            } else if (-0x80000000 <= x && x < 0x80000000) {
                var a = new Uint8Array(5);
                a[0] = INT_32;
                new DataView(a.buffer).setInt32(1, x);
                msg.write(a);
            } else {
                // DataView does not support anything above 32-bit
                // integers but all JavaScript numbers are double
                // precision floating points anyway, so if we have
                // anything outside of that range, we'll just pack it
                // as a float.
                packFloat(x);
            }
        }

        function packFloat(x) {
            var a = new Uint8Array(9);
            a[0] = FLOAT_64;
            new DataView(a.buffer).setFloat64(1, x);
            msg.write(a);
        }

        function packText(x) {
            var bytes = encoder.encode(x);
            var size = bytes.length;
            if (size < 0x10) {
                msg.write(new Uint8Array([TINY_TEXT | size]));
                msg.write(bytes);
            } else if (size < 0x100) {
                msg.write(new Uint8Array([TEXT_8, size]));
                msg.write(bytes);
            } else if (size < 0x10000) {
                msg.write(new Uint8Array([TEXT_16, size/256>>0, size%256]));
                msg.write(bytes);
            } else if (size < 0x100000000) {
                msg.write(new Uint8Array([TEXT_32, (size/16777216>>0)%256, (size/65536>>0)%256, (size/256>>0)%256, size%256]));
                msg.write(bytes);
            } else {
                throw new ProtocolError("UTF-8 strings of size " + size + " are not supported");
            }
        }

        function packListHeader(size) {
            if (size < 0x10) {
                msg.write(new Uint8Array([TINY_LIST | size]));
            } else if (size < 0x100) {
                msg.write(new Uint8Array([LIST_8, size]));
            } else if (size < 0x10000) {
                msg.write(new Uint8Array([LIST_16, size/256>>0, size%256]));
            } else if (size < 0x100000000) {
                msg.write(new Uint8Array([LIST_32, (size/16777216>>0)%256, (size/65536>>0)%256, (size/256>>0)%256, size%256]));
            } else {
                throw new ProtocolError("Lists of size " + size + " are not supported");
            }
        }

        function packMapHeader(size) {
            if (size < 0x10) {
                msg.write(new Uint8Array([TINY_MAP | size]));
            } else if (size < 0x100) {
                msg.write(new Uint8Array([MAP_8, size]));
            } else if (size < 0x10000) {
                msg.write(new Uint8Array([MAP_16, size/256>>0, size%256]));
            } else if (size < 0x100000000) {
                msg.write(new Uint8Array([MAP_32, (size/16777216>>0)%256, (size/65536>>0)%256, (size/256>>0)%256, size%256]));
            } else {
                throw new ProtocolError("Maps of size " + size + " are not supported");
            }
        }

        function packStructHeader(size, signature) {
            if (size < 0x10) {
                msg.write(new Uint8Array([TINY_STRUCT | size, signature]));
            } else if (size < 0x100) {
                msg.write(new Uint8Array([STRUCT_8, size]));
            } else if (size < 0x10000) {
                msg.write(new Uint8Array([STRUCT_16, size/256>>0, size%256]));
            } else {
                throw new ProtocolError("Structures of size " + size + " are not supported");
            }
        }

        var bytes = function bytes() {
            return Uint8Array(data);
        }

    }

    function Unpacker(data) {
        var p = 0,
            view = new DataView(data.buffer),
            decoder = new TextDecoder();

        function read() {
            var ch = data[p];
            p += 1;
            return ch;
        }

        function readUint16() {
            var q = p;
            readBytes(2);
            return view.getUint16(q);
        }

        function readUint32() {
            var q = p;
            readBytes(4);
            return view.getUint32(q);
        }

        function readUint64() {
            var q = p;
            readBytes(8);
            return view.getUint64(q);
        }

        function readBytes(n) {
            var q = p + n,
                s = data.subarray(p, q);
            p = q;
            return s;
        }

        function readList(size) {
            var value = [];
            for(var i = 0; i < size; i++)
                value.push(unpack());
            return value;
        }

        function readMap(size) {
            var value = {};
            for(var i = 0; i < size; i++) {
                var key = unpack();
                value[key] = unpack();
            }
            return value;
        }

        function readStruct(size) {
            var signature = read(),
                value = new Structure(signature, []);
            for(var i = 0; i < size; i++)
                value.fields.push(unpack());
            return value;
        }

        function unpack() {
            var marker = read(), q = p;
            if (marker >= 0 && marker < 128) {
                return marker;
            } else if (marker >= 240 && marker < 256) {
                return marker - 256;
            } else if (marker == NULL) {
                return null;
            } else if (marker == TRUE) {
                return true;
            } else if (marker == FALSE) {
                return false;
            } else if (marker == FLOAT_64) {
                p += 8;
                return view.getFloat64(q);
            } else if (marker == INT_8) {
                p += 1;
                return view.getInt8(q);
            } else if (marker == INT_16) {
                p += 2;
                return view.getInt16(q);
            } else if (marker == INT_32) {
                p += 4;
                return view.getInt32(q);
            } else if (marker == INT_64) {
                p += 8;
                return view.getInt64(q);
            } else if (marker == TEXT_8) {
                return decoder.decode(readBytes(read()));
            } else if (marker == TEXT_16) {
                return decoder.decode(readBytes(readUint16()));
            } else if (marker == TEXT_32) {
                return decoder.decode(readBytes(readUint32()));
            } else if (marker == LIST_8) {
                return readList(read());
            } else if (marker == LIST_16) {
                return readList(readUint16());
            } else if (marker == LIST_32) {
                return readList(readUint32());
            } else if (marker == MAP_8) {
                return readMap(read());
            } else if (marker == MAP_16) {
                return readMap(readUint16());
            } else if (marker == MAP_32) {
                return readMap(readUint32());
            } else if (marker == STRUCT_8) {
                return readStruct(read());
            } else if (marker == STRUCT_16) {
                return readStruct(readUint16());
            }
            var markerHigh = marker & 0xF0;
            if (markerHigh == 0x80) {
                return decoder.decode(readBytes(marker & 0x0F));
            } else if (markerHigh == 0x90) {
                return readList(marker & 0x0F);
            } else if (markerHigh == 0xA0) {
                return readMap(marker & 0x0F);
            } else if (markerHigh == 0xB0) {
                return readStruct(marker & 0x0F);
            } else {
                throw new ProtocolError("Unknown packed value with marker " + marker.toString(16));
            }
        }
        this.unpack = unpack;

    }

    function Session(onReady) {
        var receiver = null,
            responseHandlers = [],
            ready = false,
            requests = [];

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

        var ws = new WebSocket("ws://localhost:7688/"),
            msg = new Message(ws),
            packer = new Packer(msg);
        ws.onmessage = function(event) {
            var reader = new FileReader();
            reader.addEventListener("loadend", function() {
                recv(reader.result);
            });
            reader.readAsArrayBuffer(event.data);
        };
        ws.onopen = function(event) {
            debug("~~ [CONNECT] " + event.target.url);
            handshake();
        };
        ws.onclose = function(event) {
            debug("~~ [CLOSE]");
        };

    }

    function debug(obj) {
        console.log(obj);
    }

    // Expose public classes
    window.Session = Session;
    window.Node = Node;
    window.Relationship = Relationship;
    window.Path = Path;

}());
