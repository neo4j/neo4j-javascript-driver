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

let SERVER_VERSION_REGEX = new RegExp("(Neo4j/)?(\\d+)\\.(\\d+)(?:\\.)?(\\d*)(\\.|-|\\+)?([0-9A-Za-z-.]*)?");

class ServerVersion {
  constructor(major, minor, patch) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
  }

  static fromString(versionStr) {
    if (!versionStr) {
      return new ServerVersion(3, 0, 0);
    }
    else {
      const version = versionStr.match(SERVER_VERSION_REGEX);
      return new ServerVersion(version[2], version[3], version[4]);
    }
  }

  compare(other) {
    const version = this._parseToNumber();
    const otherVersion = other._parseToNumber();

    if (version == otherVersion) {
      return 0;
    }
    if (version > otherVersion) {
      return 1;
    }
    else {
      return -1;
    }
  }

  _parseToNumber() {
    let value = 0;
    value += parseInt(this._major) * 100 + parseInt(this._minor) * 10;
    if (!isEmptyObjectOrNull(this._patch)) {
      value += parseInt(this._patch);
    }
    return value;
  }
}

const VERSION3_2 = new ServerVersion(3, 2, 0);

export{
  ServerVersion,
  VERSION3_2
}




