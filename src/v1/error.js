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

// A common place for constructing error objects, to keep them
// uniform across the driver surface.

let SERVICE_UNAVAILABLE = 'ServiceUnavailable';
let SESSION_EXPIRED = 'SessionExpired';
function newError(message, code="N/A") {
  // TODO: Idea is that we can check the cod here and throw sub-classes
  // of Neo4jError as appropriate
  return new Neo4jError(message, code);
}

class Neo4jError extends Error {
  constructor( message, code="N/A" ) {
    super( message );
    this.message = message;
    this.code = code;
  }
}

export {
  newError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
}
