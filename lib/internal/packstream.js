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
import {debug} from "./log";
import utf8 from "./utf8";

let MAX_CHUNK_SIZE = 16383,

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
STRUCT_16 = 0xDD;

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
      if (x == x>>0) {
        this.packInteger(x);
      } else {
        this.packFloat(x);
      }
    } else if (typeof(x) == "string") {
      this.packText(x);
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
        this.packText(key);
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
    if (-0x10 <= x && x < 0x80) {
      this._ch.writeUInt8(x);
    } else if (-0x80 <= x && x < -0x10) {
      this._ch.writeUInt8(INT_8);
      this._ch.writeUInt8(x);
    } else if (-0x8000 <= x && x < 0x8000) {
      this._ch.writeUInt8(INT_16);
      this._ch.writeInt16(x);
    } else if (-0x80000000 <= x && x < 0x80000000) {
      this._ch.writeUInt8(INT_32);
      this._ch.writeInt32(x);
    } else {
      // DataView does not support anything above 32-bit
      // integers but all JavaScript numbers are double
      // precision floating points anyway, so if we have
      // anything outside of that range, we'll just pack it
      // as a float.
      // TODO: Look into using a wrapping mechanism here, like BigInteger,
      // to accurately map the Neo type system.
      this.packFloat(x);
    }
  }

  packFloat (x) {
    this._ch.writeUInt8(FLOAT_64);
    this._ch.writeFloat64(x);
  }

  packText (x) {
    let bytes = utf8.encode(x);
    let size = bytes.length;
    if (size < 0x10) {
      this._ch.writeUInt8(TINY_TEXT | size);
      this._ch.writeBytes(bytes);
    } else if (size < 0x100) {
      this._ch.writeUInt8(TEXT_8)
      this._ch.writeUInt8(size);
      this._ch.writeBytes(bytes);
    } else if (size < 0x10000) {
      this._ch.writeUInt8(TEXT_16);
      this._ch.writeUInt8(size/256>>0);
      this._ch.writeUInt8(size%256);
      this._ch.writeBytes(bytes);
    } else if (size < 0x100000000) {
      this._ch.writeUInt8(TEXT_32);
      this._ch.writeUInt8((size/16777216>>0)%256); // TODO: Why is it shifting by 0 here?
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
      this._ch.writeUInt8(LIST_16, size/256>>0, size%256);
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

class Unpacker {
  constructor () {

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
    let signature = buffer.readUInt8(),
        value = new Structure(signature, []);
    for(let i = 0; i < size; i++) {
      value.fields.push(this.unpack(buffer));
    } 
    return value;
  }

  unpack ( buffer ) {
    let marker = buffer.readUInt8();
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
      return buffer.readFloat64();
    } else if (marker == INT_8) {
      return buffer.readByte();
    } else if (marker == INT_16) {
      return buffer.readInt16();
    } else if (marker == INT_32) {
      return buffer.readInt32();
    } else if (marker == INT_64) {
      return buffer.readInt64();
    } else if (marker == TEXT_8) {
      return utf8.decode( buffer, buffer.readByte());
    } else if (marker == TEXT_16) {
      return utf8.decode( buffer, buffer.readUint16() );
    } else if (marker == TEXT_32) {
      return utf8.decode( buffer, buffer.readUint32() );
    } else if (marker == LIST_8) {
      return this.unpackList(buffer.readByte(), buffer);
    } else if (marker == LIST_16) {
      return this.unpackList(buffer.readUint16(), buffer);
    } else if (marker == LIST_32) {
      return this.unpackList(buffer.readUint32(), buffer);
    } else if (marker == MAP_8) {
      return readMap(buffer.readByte());
    } else if (marker == MAP_16) {
      return readMap(buffer.readUint16());
    } else if (marker == MAP_32) {
      return readMap(buffer.readUint32());
    } else if (marker == STRUCT_8) {
      return readStruct(buffer.readByte());
    } else if (marker == STRUCT_16) {
      return readStruct(buffer.readUint16());
    }
    let markerHigh = marker & 0xF0;
    let markerLow = marker & 0x0F;
    if (markerHigh == 0x80) {
      return utf8.decode( buffer, markerLow );
    } else if (markerHigh == 0x90) {
      return this.unpackList(markerLow, buffer);
    } else if (markerHigh == 0xA0) {
      return readMap(markerLow);
    } else if (markerHigh == 0xB0) {
      return readStruct(markerLow);
    } else {
      throw new ProtocolError("Unknown packed value with marker " + marker.toString(16));
    }
  }
}

export default {
  Packer,
  Unpacker
};
