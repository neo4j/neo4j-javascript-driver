"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Structure = exports.Unpacker = exports.Packer = undefined;

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _utf = require("./utf8");

var _utf2 = _interopRequireDefault(_utf);

var _integer = require("../integer");

var _integer2 = _interopRequireDefault(_integer);

var _error = require("./../error");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TINY_STRING = 0x80; /**
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

var TINY_LIST = 0x90;
var TINY_MAP = 0xA0;
var TINY_STRUCT = 0xB0;
var NULL = 0xC0;
var FLOAT_64 = 0xC1;
var FALSE = 0xC2;
var TRUE = 0xC3;
var INT_8 = 0xC8;
var INT_16 = 0xC9;
var INT_32 = 0xCA;
var INT_64 = 0xCB;
var STRING_8 = 0xD0;
var STRING_16 = 0xD1;
var STRING_32 = 0xD2;
var LIST_8 = 0xD4;
var LIST_16 = 0xD5;
var LIST_32 = 0xD6;
var MAP_8 = 0xD8;
var MAP_16 = 0xD9;
var MAP_32 = 0xDA;
var STRUCT_8 = 0xDC;
var STRUCT_16 = 0xDD;

/**
  * A Structure have a signature and fields.
  * @access private
  */

var Structure = function () {
  /**
   * Create new instance
   */
  function Structure(signature, fields) {
    (0, _classCallCheck3.default)(this, Structure);

    this.signature = signature;
    this.fields = fields;
  }

  (0, _createClass3.default)(Structure, [{
    key: "toString",
    value: function toString() {
      var fieldStr = "";
      for (var i = 0; i < this.fields.length; i++) {
        if (i > 0) {
          fieldStr += ", ";
        }
        fieldStr += this.fields[i];
      }
      return "Structure(" + this.signature + ", [" + this.fields + "])";
    }
  }]);
  return Structure;
}();

/**
  * Class to pack
  * @access private
  */


var Packer = function () {
  function Packer(channel) {
    (0, _classCallCheck3.default)(this, Packer);

    this._ch = channel;
  }

  /**
   * Creates a packable function out of the provided value
   * @param x the value to pack
   * @param onError callback for the case when value cannot be packed
   * @returns Function
   */


  (0, _createClass3.default)(Packer, [{
    key: "packable",
    value: function packable(x, onError) {
      var _this = this;

      if (x === null) {
        return function () {
          return _this._ch.writeUInt8(NULL);
        };
      } else if (x === true) {
        return function () {
          return _this._ch.writeUInt8(TRUE);
        };
      } else if (x === false) {
        return function () {
          return _this._ch.writeUInt8(FALSE);
        };
      } else if (typeof x == "number") {
        return function () {
          return _this.packFloat(x);
        };
      } else if (typeof x == "string") {
        return function () {
          return _this.packString(x, onError);
        };
      } else if ((0, _integer.isInt)(x)) {
        return function () {
          return _this.packInteger(x);
        };
      } else if (x instanceof Array) {
        return function () {
          _this.packListHeader(x.length, onError);
          for (var _i = 0; _i < x.length; _i++) {
            _this.packable(x[_i] === undefined ? null : x[_i], onError)();
          }
        };
      } else if (x instanceof Structure) {
        var packableFields = [];
        for (var i = 0; i < x.fields.length; i++) {
          packableFields[i] = this.packable(x.fields[i], onError);
        }
        return function () {
          return _this.packStruct(x.signature, packableFields);
        };
      } else if ((typeof x === "undefined" ? "undefined" : (0, _typeof3.default)(x)) == "object") {
        return function () {
          var keys = (0, _keys2.default)(x);

          var count = 0;
          for (var _i2 = 0; _i2 < keys.length; _i2++) {
            if (x[keys[_i2]] !== undefined) {
              count++;
            }
          }
          _this.packMapHeader(count, onError);
          for (var _i3 = 0; _i3 < keys.length; _i3++) {
            var key = keys[_i3];
            if (x[key] !== undefined) {
              _this.packString(key);
              _this.packable(x[key], onError)();
            }
          }
        };
      } else {
        if (onError) {
          onError((0, _error.newError)("Cannot pack this value: " + x));
        }
        return function () {
          return undefined;
        };
      }
    }

    /**
     * Packs a struct
     * @param signature the signature of the struct
     * @param packableFields the fields of the struct, make sure you call `packable on all fields`
     */

  }, {
    key: "packStruct",
    value: function packStruct(signature, packableFields, onError) {
      packableFields = packableFields || [];
      this.packStructHeader(packableFields.length, signature, onError);
      for (var i = 0; i < packableFields.length; i++) {
        packableFields[i]();
      }
    }
  }, {
    key: "packInteger",
    value: function packInteger(x) {
      var high = x.high,
          low = x.low;

      if (x.greaterThanOrEqual(-0x10) && x.lessThan(0x80)) {
        this._ch.writeInt8(low);
      } else if (x.greaterThanOrEqual(-0x80) && x.lessThan(-0x10)) {
        this._ch.writeUInt8(INT_8);
        this._ch.writeInt8(low);
      } else if (x.greaterThanOrEqual(-0x8000) && x.lessThan(0x8000)) {
        this._ch.writeUInt8(INT_16);
        this._ch.writeInt16(low);
      } else if (x.greaterThanOrEqual(-0x80000000) && x.lessThan(0x80000000)) {
        this._ch.writeUInt8(INT_32);
        this._ch.writeInt32(low);
      } else {
        this._ch.writeUInt8(INT_64);
        this._ch.writeInt32(high);
        this._ch.writeInt32(low);
      }
    }
  }, {
    key: "packFloat",
    value: function packFloat(x) {
      this._ch.writeUInt8(FLOAT_64);
      this._ch.writeFloat64(x);
    }
  }, {
    key: "packString",
    value: function packString(x, onError) {
      var bytes = _utf2.default.encode(x);
      var size = bytes.length;
      if (size < 0x10) {
        this._ch.writeUInt8(TINY_STRING | size);
        this._ch.writeBytes(bytes);
      } else if (size < 0x100) {
        this._ch.writeUInt8(STRING_8);
        this._ch.writeUInt8(size);
        this._ch.writeBytes(bytes);
      } else if (size < 0x10000) {
        this._ch.writeUInt8(STRING_16);
        this._ch.writeUInt8(size / 256 >> 0);
        this._ch.writeUInt8(size % 256);
        this._ch.writeBytes(bytes);
      } else if (size < 0x100000000) {
        this._ch.writeUInt8(STRING_32);
        this._ch.writeUInt8((size / 16777216 >> 0) % 256);
        this._ch.writeUInt8((size / 65536 >> 0) % 256);
        this._ch.writeUInt8((size / 256 >> 0) % 256);
        this._ch.writeUInt8(size % 256);
        this._ch.writeBytes(bytes);
      } else {
        onError((0, _error.newError)("UTF-8 strings of size " + size + " are not supported"));
      }
    }
  }, {
    key: "packListHeader",
    value: function packListHeader(size, onError) {
      if (size < 0x10) {
        this._ch.writeUInt8(TINY_LIST | size);
      } else if (size < 0x100) {
        this._ch.writeUInt8(LIST_8);
        this._ch.writeUInt8(size);
      } else if (size < 0x10000) {
        this._ch.writeUInt8(LIST_16);
        this._ch.writeUInt8((size / 256 >> 0) % 256);
        this._ch.writeUInt8(size % 256);
      } else if (size < 0x100000000) {
        this._ch.writeUInt8(LIST_32);
        this._ch.writeUInt8((size / 16777216 >> 0) % 256);
        this._ch.writeUInt8((size / 65536 >> 0) % 256);
        this._ch.writeUInt8((size / 256 >> 0) % 256);
        this._ch.writeUInt8(size % 256);
      } else {
        onError((0, _error.newError)("Lists of size " + size + " are not supported"));
      }
    }
  }, {
    key: "packMapHeader",
    value: function packMapHeader(size, onError) {
      if (size < 0x10) {
        this._ch.writeUInt8(TINY_MAP | size);
      } else if (size < 0x100) {
        this._ch.writeUInt8(MAP_8);
        this._ch.writeUInt8(size);
      } else if (size < 0x10000) {
        this._ch.writeUInt8(MAP_16);
        this._ch.writeUInt8(size / 256 >> 0);
        this._ch.writeUInt8(size % 256);
      } else if (size < 0x100000000) {
        this._ch.writeUInt8(MAP_32);
        this._ch.writeUInt8((size / 16777216 >> 0) % 256);
        this._ch.writeUInt8((size / 65536 >> 0) % 256);
        this._ch.writeUInt8((size / 256 >> 0) % 256);
        this._ch.writeUInt8(size % 256);
      } else {
        onError((0, _error.newError)("Maps of size " + size + " are not supported"));
      }
    }
  }, {
    key: "packStructHeader",
    value: function packStructHeader(size, signature, onError) {
      if (size < 0x10) {
        this._ch.writeUInt8(TINY_STRUCT | size);
        this._ch.writeUInt8(signature);
      } else if (size < 0x100) {
        this._ch.writeUInt8(STRUCT_8);
        this._ch.writeUInt8(size);
        this._ch.writeUInt8(signature);
      } else if (size < 0x10000) {
        this._ch.writeUInt8(STRUCT_16);
        this._ch.writeUInt8(size / 256 >> 0);
        this._ch.writeUInt8(size % 256);
      } else {
        onError((0, _error.newError)("Structures of size " + size + " are not supported"));
      }
    }
  }]);
  return Packer;
}();

/**
  * Class to unpack
  * @access private
  */


var Unpacker = function () {
  function Unpacker() {
    (0, _classCallCheck3.default)(this, Unpacker);

    // Higher level layers can specify how to map structs to higher-level objects.
    // If we recieve a struct that has a signature that does not have a mapper,
    // we simply return a Structure object.
    this.structMappers = {};
  }

  (0, _createClass3.default)(Unpacker, [{
    key: "unpackList",
    value: function unpackList(size, buffer) {
      var value = [];
      for (var i = 0; i < size; i++) {
        value.push(this.unpack(buffer));
      }
      return value;
    }
  }, {
    key: "unpackMap",
    value: function unpackMap(size, buffer) {
      var value = {};
      for (var i = 0; i < size; i++) {
        var key = this.unpack(buffer);
        value[key] = this.unpack(buffer);
      }
      return value;
    }
  }, {
    key: "unpackStruct",
    value: function unpackStruct(size, buffer) {
      var signature = buffer.readUInt8();
      var mapper = this.structMappers[signature];
      if (mapper) {
        return mapper(this, buffer);
      } else {
        var value = new Structure(signature, []);
        for (var i = 0; i < size; i++) {
          value.fields.push(this.unpack(buffer));
        }
        return value;
      }
    }
  }, {
    key: "unpack",
    value: function unpack(buffer) {
      var marker = buffer.readUInt8();
      if (marker == NULL) {
        return null;
      } else if (marker == TRUE) {
        return true;
      } else if (marker == FALSE) {
        return false;
      } else if (marker == FLOAT_64) {
        return buffer.readFloat64();
      } else if (marker >= 0 && marker < 128) {
        return (0, _integer.int)(marker);
      } else if (marker >= 240 && marker < 256) {
        return (0, _integer.int)(marker - 256);
      } else if (marker == INT_8) {
        return (0, _integer.int)(buffer.readInt8());
      } else if (marker == INT_16) {
        return (0, _integer.int)(buffer.readInt16());
      } else if (marker == INT_32) {
        var b = buffer.readInt32();
        return (0, _integer.int)(b);
      } else if (marker == INT_64) {
        var high = buffer.readInt32();
        var low = buffer.readInt32();
        return new _integer2.default(low, high);
      } else if (marker == STRING_8) {
        return _utf2.default.decode(buffer, buffer.readUInt8());
      } else if (marker == STRING_16) {
        return _utf2.default.decode(buffer, buffer.readUInt16());
      } else if (marker == STRING_32) {
        return _utf2.default.decode(buffer, buffer.readUInt32());
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
      var markerHigh = marker & 0xF0;
      var markerLow = marker & 0x0F;
      if (markerHigh == 0x80) {
        return _utf2.default.decode(buffer, markerLow);
      } else if (markerHigh == 0x90) {
        return this.unpackList(markerLow, buffer);
      } else if (markerHigh == 0xA0) {
        return this.unpackMap(markerLow, buffer);
      } else if (markerHigh == 0xB0) {
        return this.unpackStruct(markerLow, buffer);
      } else {
        throw (0, _error.newError)("Unknown packed value with marker " + marker.toString(16));
      }
    }
  }]);
  return Unpacker;
}();

exports.Packer = Packer;
exports.Unpacker = Unpacker;
exports.Structure = Structure;