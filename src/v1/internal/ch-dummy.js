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

import {CombinedBuffer} from './buf';
const observer = {
  instance: null,
  updateInstance: (instance) => {
    observer.instance = instance
  }
}

class DummyChannel {
  constructor(opts) {
    this.written = [];
  }
  write( buf ) {
    this.written.push(buf);
    observer.updateInstance(this);
  }
  toHex() {
    var out = "";
    for( var i=0; i<this.written.length; i++ ) {
      out += this.written[i].toHex();
    }
    return out;
  }
  toBuffer () {
    return new CombinedBuffer( this.written );
  }
}

export default {
  channel: DummyChannel,
  observer: observer
}
