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

// A common place for constructing error objects, to keep them
// uniform across the driver surface.

/**
 * Error code representing complete loss of service. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const SERVICE_UNAVAILABLE = 'ServiceUnavailable';

/**
 * Error code representing transient loss of service. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const SESSION_EXPIRED = 'SessionExpired';

/**
 * Error code representing serialization/deserialization issue in the Bolt protocol. Used by {@link Neo4jError#code}.
 * @type {string}
 */
const PROTOCOL_ERROR = 'ProtocolError';

function newError(message, code="N/A") {
  // TODO: Idea is that we can check the code here and throw sub-classes
  // of Neo4jError as appropriate
  return new Neo4jError(message, code);
}

/**
 * Class for all errors thrown/returned by the driver.
 */
class Neo4jError extends Error {

  /**
   * @constructor
   * @param {string} message - The error message.
   * @param {string} code - Optional error code. Will be populated when error originates in the database.
   */
  constructor(message, code = 'N/A') {
    super( message );
    this.message = message;
    this.code = code;
    this.name = "Neo4jError"
  }
}

export {
  newError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
}
