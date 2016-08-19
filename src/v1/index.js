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
import {Neo4jError} from './error';
import Result from './result';
import ResultSummary from './result-summary';
import {Record} from './record';

export default {
  driver,
  int,
  isInt,
  Neo4jError,
  auth: {
    basic: (username, password) => {
      return {scheme: "basic", principal: username, credentials: password};
    }
  },
  types: {
    Node,
    Relationship,
    UnboundRelationship,
    PathSegment,
    Path,
    Result,
    ResultSummary,
    Record
  }
}
