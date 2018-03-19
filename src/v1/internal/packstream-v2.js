/**
 * Copyright (c) 2002-2018 "Neo Technology,"
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

import * as v1 from './packstream-v1';
import {isPoint, Point} from '../spatial-types';
import {int} from '../integer';

const POINT_2D = 0x58;
const POINT_3D = 0x59;

export class Packer extends v1.Packer {

  /**
   * @constructor
   * @param {Chunker} chunker the chunker backed by a network channel.
   */
  constructor(chunker) {
    super(chunker);
  }

  disableByteArrays() {
    throw new Error('Bolt V2 should always support byte arrays');
  }

  packable(obj, onError) {
    if (isPoint(obj)) {
      return () => packPoint(obj, this, onError);
    } else {
      return super.packable(obj, onError);
    }
  }
}

export class Unpacker extends v1.Unpacker {

  /**
   * @constructor
   * @param {boolean} disableLosslessIntegers if this unpacker should convert all received integers to native JS numbers.
   */
  constructor(disableLosslessIntegers = false) {
    super(disableLosslessIntegers);
  }


  _unpackUnknownStruct(signature, size, buffer) {
    if (signature == POINT_2D) {
      return unpackPoint2D(this, buffer);
    } else if (signature == POINT_3D) {
      return unpackPoint3D(this, buffer);
    } else {
      return super._unpackUnknownStruct(signature, size, buffer);
    }
  }
}

function packPoint(point, packer, onError) {
  const is2DPoint = point.z === null || point.z === undefined;
  if (is2DPoint) {
    packPoint2D(point, packer, onError);
  } else {
    packPoint3D(point, packer, onError);
  }
}

function packPoint2D(point, packer, onError) {
  const packableStructFields = [
    packer.packable(int(point.srid), onError),
    packer.packable(point.x, onError),
    packer.packable(point.y, onError)
  ];
  packer.packStruct(POINT_2D, packableStructFields, onError);
}

function packPoint3D(point, packer, onError) {
  const packableStructFields = [
    packer.packable(int(point.srid), onError),
    packer.packable(point.x, onError),
    packer.packable(point.y, onError),
    packer.packable(point.z, onError)
  ];
  packer.packStruct(POINT_3D, packableStructFields, onError);
}

function unpackPoint2D(unpacker, buffer) {
  return new Point(
    unpacker.unpack(buffer), // srid
    unpacker.unpack(buffer), // x
    unpacker.unpack(buffer), // y
    undefined                // z
  );
}

function unpackPoint3D(unpacker, buffer) {
  return new Point(
    unpacker.unpack(buffer), // srid
    unpacker.unpack(buffer), // x
    unpacker.unpack(buffer), // y
    unpacker.unpack(buffer)  // z
  );
}
