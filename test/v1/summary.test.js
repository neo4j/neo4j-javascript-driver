/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import neo4j from '../../src/v1';
import sharedNeo4j from '../internal/shared-neo4j';

describe('result summary', () => {

  let driver, session;

  beforeEach(done => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    session = driver.session();

    session.run("MATCH (n) DETACH DELETE n").then(done);
  });

  afterEach(() => {
    driver.close();
  });

  fit('should get result summary', done => {
    // When & Then
    session.run("CREATE (p:Person { Name: 'Test'})").then(result => {
      var summary = result.summary;

      expect(summary.statement.text).toBe("CREATE (p:Person { Name: 'Test'})");
      expect(summary.statement.parameters).toEqual({});

      expect(summary.statementType).toBe("w");
      expect(summary.plan).toBe(false);
      expect(summary.profile).toBe(false);
      expect(summary.notifications).toEqual([]);
      expect(summary.resultConsumedAfter).toBeDefined();
      expect(summary.resultAvailableAfter).toBeDefined();

      var counters = summary.counters;
      expect(counters.nodesCreated()).toBe(1);
      expect(counters.nodesDeleted()).toBe(0);
      expect(counters.relationshipsCreated()).toBe(0);
      expect(counters.relationshipsDeleted()).toBe(0);
      expect(counters.propertiesSet()).toBe(1);
      expect(counters.labelsAdded()).toBe(1);
      expect(counters.labelsRemoved()).toBe(0);
      expect(counters.indexesAdded()).toBe(0);
      expect(counters.indexesRemoved()).toBe(0);
      expect(counters.constraintsAdded()).toBe(0);
      expect(counters.constraintsRemoved()).toBe(0);
      done();
    });
  });
});
