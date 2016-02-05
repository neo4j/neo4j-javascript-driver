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
 
import {debug} from "./log";
import {alloc} from "./buf";
import utf8 from "./utf8";
import {Integer, int} from "../integer";

let MAX_CHUNK_SIZE = 16383,
TINY_STRING = 0x80,
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
STRING_8 = 0xD0,
STRING_16 = 0xD1,
STRING_32 = 0xD2,
LIST_8 = 0xD4,
LIST_16 = 0xD5,
LIST_32 = 0xD6,
MAP_8 = 0xD8,
MAP_16 = 0xD9,
MAP_32 = 0xDA,
STRUCT_8 = 0xDC,
STRUCT_16 = 0xDD;

/**
  * A Structure have a signature and fields.
  * @access private
  */
class Structure {
  /**
   * Create new instance
   */
  constructor( signature, fields ) {
    this.signature = signature;
    this.fields = fields;
  }

  toString() {
    let fieldStr = "";
    for (var i = 0; i < this.fields.length; i++) {
      if(i > 0) { fieldStr+=", " }
      fieldStr += this.fields[i];
    }
    return "Structure(" + this.signature + ", [" + this.fields + "])"
  }
}

/**
  * Class to pack
  * @access private
  */
class Packer {
  constructor (channel) {
    this._ch = channel;
  }

  pack (x) {
    if (x === null) {
      this._ch.writeUInt8( NULL );
    } else if (x === true) {
      this._ch.writeUInt8( TRUE );
    } else if (x === false) {
      this._ch.writeUInt8( FALSE );
    } else if (typeof(x) == "number") {
      this.packFloat(x);
    } else if (typeof(x) == "string") {
      this.packString(x);
    } else if (x instanceof Integer) {
      this.packInteger( x );
    } else if (x instanceof Array) {
      this.packListHeader(x.length);
      for(let i = 0; i < x.length; i++) {
        this.pack(x[i]);
      }
    } else if (x instanceof Structure) {
      this.packStruct( x.signature, x.fields );
    } else if (typeof(x) == "object") {
      let keys = Object.keys(x);
      this.packMapHeader(keys.length);
      for(let i = 0; i < keys.length; i++) {
        let key = keys[i];
        this.packString(key);
        this.pack(x[key]);
      }
    } else {
      throw new Error("Cannot pack this value: " + x);
    }
  }

  packStruct ( signature, fields ) {
    fields = fields || [];
    this.packStructHeader(fields.length, signature);
    for(let i = 0; i < fields.length; i++) {
      this.pack(fields[i]);
    }
  }

  packInteger (x) {
    var high = x.high,
        low  = x.low;

    if (x.greaterThanOrEqual(-0x10) && x.lessThan(0x80)) {
      this._ch.writeInt8(low);
    }
    else if (x.greaterThanOrEqual(-0x80) && x.lessThan(-0x10)) {
      this._ch.writeUInt8(INT_8);
      this._ch.writeInt8(low);
    }
    else if (x.greaterThanOrEqual(-0x8000) && x.lessThan(0x8000)) {
      this._ch.writeUInt8(INT_16);
      this._ch.writeInt16(low);
    }
    else if (x.greaterThanOrEqual(-0x80000000) && x.lessThan(0x80000000)) {
      this._ch.writeUInt8(INT_32);
      this._ch.writeInt32(low);
    }
    else {
      this._ch.writeUInt8(INT_64);
      this._ch.writeInt32(high);
      this._ch.writeInt32(low);
    }
  }

  packFloat(x) {
    this._ch.writeUInt8(FLOAT_64);
    this._ch.writeFloat64(x);
  }

  packString (x) {
    let bytes = utf8.encode(x);
    let size = bytes.length;
    if (size < 0x10) {
      this._ch.writeUInt8(TINY_STRING | size);
      this._ch.writeBytes(bytes);
    } else if (size < 0x100) {
      this._ch.writeUInt8(STRING_8)
      this._ch.writeUInt8(size);
      this._ch.writeBytes(bytes);
    } else if (size < 0x10000) {
      this._ch.writeUInt8(STRING_16);
      this._ch.writeUInt8(size/256>>0);
      this._ch.writeUInt8(size%256);
      this._ch.writeBytes(bytes);
    } else if (size < 0x100000000) {
      this._ch.writeUInt8(STRING_32);
      this._ch.writeUInt8((size/16777216>>0)%256);
      this._ch.writeUInt8((size/65536>>0)%256);
      this._ch.writeUInt8((size/256>>0)%256);
      this._ch.writeUInt8(size%256);
      this._ch.writeBytes(bytes);
    } else {
      throw new ProtocolError("UTF-8 strings of size " + size + " are not supported");
    }
  }

  packListHeader (size) {
    if (size < 0x10) {
      this._ch.writeUInt8(TINY_LIST | size);
    } else if (size < 0x100) {
      this._ch.writeUInt8(LIST_8)
      this._ch.writeUInt8(size);
    } else if (size < 0x10000) {
      this._ch.writeUInt8(LIST_16);
      this._ch.writeUInt8((size/256>>0)%256);
      this._ch.writeUInt8(size%256);
    } else if (size < 0x100000000) {
      this._ch.writeUInt8(LIST_32);
      this._ch.writeUInt8((size/16777216>>0)%256);
      this._ch.writeUInt8((size/65536>>0)%256);
      this._ch.writeUInt8((size/256>>0)%256);
      this._ch.writeUInt8(size%256);
    } else {
      throw new ProtocolError("Lists of size " + size + " are not supported");
    }
  }

  packMapHeader (size) {
    if (size < 0x10) {
      this._ch.writeUInt8(TINY_MAP | size);
    } else if (size < 0x100) {
      this._ch.writeUInt8(MAP_8);
      this._ch.writeUInt8(size);
    } else if (size < 0x10000) {
      this._ch.writeUInt8(MAP_16);
      this._ch.writeUInt8(size/256>>0);
      this._ch.writeUInt8(size%256);
    } else if (size < 0x100000000) {
      this._ch.writeUInt8(MAP_32);
      this._ch.writeUInt8((size/16777216>>0)%256);
      this._ch.writeUInt8((size/65536>>0)%256);
      this._ch.writeUInt8((size/256>>0)%256);
      this._ch.writeUInt8(size%256);
    } else {
      throw new ProtocolError("Maps of size " + size + " are not supported");
    }
  }

  packStructHeader (size, signature) {
    if (size < 0x10) {
      this._ch.writeUInt8(TINY_STRUCT | size);
      this._ch.writeUInt8(signature);
    } else if (size < 0x100) {
      this._ch.writeUInt8(STRUCT_8);
      this._ch.writeUInt8(size);
      this._ch.writeUInt8(signature);
    } else if (size < 0x10000) {
      this._ch.writeUInt8(STRUCT_16);
      this._ch.writeUInt8(size/256>>0);
      this._ch.writeUInt8(size%256);
    } else {
      throw new ProtocolError("Structures of size " + size + " are not supported");
    }
  }
}

/**
  * Class to unpack
  * @access private
  */
class Unpacker {
  constructor () {
    // Higher level layers can specify how to map structs to higher-level objects.
    // If we recieve a struct that has a signature that does not have a mapper,
    // we simply return a Structure object.
    this.structMappers = {};
  }

  unpackList (size, buffer) {
    let value = [];
    for(let i = 0; i < size; i++) {
      value.push( this.unpack( buffer ) );
    } 
    return value;
  }

  unpackMap (size, buffer) {
    let value = {};
    for(let i = 0; i < size; i++) {
      let key = this.unpack(buffer);
      value[key] = this.unpack(buffer);
    }
    return value;
  }

  unpackStruct (size, buffer) {
    let signature = buffer.readUInt8();
    let mapper = this.structMappers[signature];
    if( mapper ) {
      return mapper( this, buffer );
    } else {
      let value = new Structure(signature, []);
      for(let i = 0; i < size; i++) {
        value.fields.push(this.unpack(buffer));
      } 
      return value;
    }
  }

  unpack ( buffer ) {
    let marker = buffer.readUInt8();
    if (marker == NULL) {
      return null;
    } else if (marker == TRUE) {
      return true;
    } else if (marker == FALSE) {
      return false;
    } else if (marker == FLOAT_64) {
      return buffer.readFloat64();
    } else if (marker >= 0 && marker < 128) {
      return int(marker);
    } else if (marker >= 240 && marker < 256) {
      return int(marker - 256);
    } else if (marker == INT_8) {
      return int(buffer.readInt8());
    } else if (marker == INT_16) {
      return int(buffer.readInt16());
    } else if (marker == INT_32) {
      let b = buffer.readInt32();
      return int(b);
    } else if (marker == INT_64) {
      let high = buffer.readInt32();
      let low  = buffer.readInt32();
      return new Integer( low, high );
    } else if (marker == STRING_8) {
      return utf8.decode( buffer, buffer.readUInt8());
    } else if (marker == STRING_16) {
      return utf8.decode( buffer, buffer.readUInt16() );
    } else if (marker == STRING_32) {
      return utf8.decode( buffer, buffer.readUInt32() );
    } else if (marker == LIST_8) {
      return this.unpackList(buffer.readUInt8(), buffer);
    } else if (marker == LIST_16) {
      return this.unpackList(buffer.readUInt16(), buffer);
    } else if (marker == LIST_32) {
      return this.unpackList(buffer.readUInt32(), buffer);
    } else if (marker == MAP_8) {
      return this.unpackMap(buffer.readUInt8(), buffer);
    } else if (marker == MAP_16) {
      return this.unpackMap(buffer.readUInt16(), buffer);
    } else if (marker == MAP_32) {
      return this.unpackMap(buffer.readUInt32(), buffer);
    } else if (marker == STRUCT_8) {
      return this.unpackStruct(buffer.readUInt8(), buffer);
    } else if (marker == STRUCT_16) {
      return this.unpackStruct(buffer.readUInt16(), buffer);
    }
    let markerHigh = marker & 0xF0;
    let markerLow = marker & 0x0F;
    if (markerHigh == 0x80) {
      return utf8.decode( buffer, markerLow );
    } else if (markerHigh == 0x90) {
      return this.unpackList(markerLow, buffer);
    } else if (markerHigh == 0xA0) {
      return this.unpackMap(markerLow, buffer);
    } else if (markerHigh == 0xB0) {
      return this.unpackStruct(markerLow, buffer);
    } else {
      throw new ProtocolError("Unknown packed value with marker " + marker.toString(16));
    }
  }
}

export default {
  Packer,
  Unpacker,
  Structure,
};
