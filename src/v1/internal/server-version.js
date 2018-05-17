/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

import {assertString} from './util';

const SERVER_VERSION_REGEX = new RegExp('^(Neo4j/)?(\\d+)\\.(\\d+)(?:\\.)?(\\d*)(\\.|-|\\+)?([0-9A-Za-z-.]*)?$');
const NEO4J_IN_DEV_VERSION_STRING = 'Neo4j/dev';

class ServerVersion {

  /**
   * @constructor
   * @param {number} major the major version number.
   * @param {number} minor the minor version number.
   * @param {number} patch the patch version number.
   */
  constructor(major, minor, patch) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  /**
   * Fetch server version using the given driver.
   * @param {Driver} driver the driver to use.
   * @return {Promise<ServerVersion>} promise resolved with a {@link ServerVersion} object or rejected with error.
   */
  static fromDriver(driver) {
    const session = driver.session();
    return session.run('RETURN 1').then(result => {
      session.close();
      return ServerVersion.fromString(result.summary.server.version);
    });
  }

  /**
   * Parse given string to a {@link ServerVersion} object.
   * @param {string} versionStr the string to parse.
   * @return {ServerVersion} version for the given string.
   * @throws Error if given string can't be parsed.
   */
  static fromString(versionStr) {
    if (!versionStr) {
      return new ServerVersion(3, 0, 0);
    }

    assertString(versionStr, 'Neo4j version string');

    if (versionStr.toLowerCase() === NEO4J_IN_DEV_VERSION_STRING.toLowerCase()) {
      return VERSION_IN_DEV;
    }

    const version = versionStr.match(SERVER_VERSION_REGEX);
    if (!version) {
      throw new Error(`Unparsable Neo4j version: ${versionStr}`);
    }

    const major = parseIntStrict(version[2]);
    const minor = parseIntStrict(version[3]);
    const patch = parseIntStrict(version[4] || 0);

    return new ServerVersion(major, minor, patch);
  }

  /**
   * Compare this version to the given one.
   * @param {ServerVersion} other the version to compare with.
   * @return {number} value 0 if this version is the same as the given one, value less then 0 when this version
   * was released earlier than the given one and value greater then 0 when this version was released after
   * than the given one.
   */
  compareTo(other) {
    let result = compareInts(this.major, other.major);
    if (result === 0) {
      result = compareInts(this.minor, other.minor);
      if (result === 0) {
        result = compareInts(this.patch, other.patch);
      }
    }
    return result;
  }
}

function parseIntStrict(str, name) {
  const value = parseInt(str, 10);
  if (!value && value !== 0) {
    throw new Error(`Unparsable number ${name}: '${str}'`);
  }
  return value;
}

function compareInts(x, y) {
  return (x < y) ? -1 : ((x === y) ? 0 : 1);
}

const VERSION_3_1_0 = new ServerVersion(3, 1, 0);
const VERSION_3_2_0 = new ServerVersion(3, 2, 0);
const VERSION_3_4_0 = new ServerVersion(3, 4, 0);
const VERSION_IN_DEV = new ServerVersion(0, 0, 0);

export {
  ServerVersion,
  VERSION_3_1_0,
  VERSION_3_2_0,
  VERSION_3_4_0,
  VERSION_IN_DEV
};




