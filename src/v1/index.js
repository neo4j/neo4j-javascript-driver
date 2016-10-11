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

import {int, isInt} from './integer';
import {driver} from './driver';
import {Node, Relationship, UnboundRelationship, PathSegment, Path} from './graph-types'
import {Neo4jError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from './error';
import Result from './result';
import ResultSummary from './result-summary';
import Record from './record';
import {READ, WRITE} from './driver';

const auth ={
  basic: (username, password, realm = undefined) => {
    if (realm) {
      return {scheme: "basic", principal: username, credentials: password, realm: realm};
    } else {
      return {scheme: "basic", principal: username, credentials: password};
    }
  },
    custom: (principal, credentials, realm, scheme, parameters = undefined ) => {
    if (parameters) {
      return  {scheme: scheme, principal: principal, credentials: credentials, realm: realm,
        parameters: parameters}
    } else {
      return  {scheme: scheme, principal: principal, credentials: credentials, realm: realm}
    }
  }
};

const types ={
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Result,
  ResultSummary,
  Record
  };

const forExport = {
  driver,
  int,
  isInt,
  Neo4jError,
  auth,
  types,
  READ,
  WRITE,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
};

export {
  driver,
  int,
  isInt,
  Neo4jError,
  auth,
  types,
  READ,
  WRITE,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
}
export default forExport
