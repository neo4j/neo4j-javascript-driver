/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

const neo4j = require('neo4j')

const query = [
  'MERGE (alice:Person {name:$name_a}) ON CREATE SET alice.age = $age_a',
  'MERGE (bob:Person {name:$name_b}) ON CREATE SET bob.age = $age_b',
  'MERGE (alice)-[alice_knows_bob:KNOWS]->(bob)',
  'RETURN alice, bob, alice_knows_bob'
]

const params = {
  name_a: 'Alice',
  age_a: 33,
  name_b: 'Bob',
  age_b: 44
}

const driver = neo4j.driver('bolt://localhost')

const streamSession = driver.session()
const streamResult = streamSession.run(query.join(' '), params)
streamResult.subscribe({
  onNext: function (record) {
    // On receipt of RECORD
    for (const i in record) {
      console.log(i)
      console.log(record[i])
    }
  },
  onCompleted: function () {
    const summary = streamResult.summarize()
    // Print number of nodes created
    console.log('')
    console.log(summary.updateStatistics.nodesCreated())
    streamSession.close()
  },
  onError: function (error) {
    console.log(error)
  }
})

const promiseSession = driver.session()
const promiseResult = promiseSession.run(query.join(' '), params)
promiseResult
  .then(function (records) {
    records.forEach(function (record) {
      for (const i in record) {
        console.log(i)
        console.log(record[i])
      }
    })
    const summary = promiseResult.summarize()
    // Print number of nodes created
    console.log('')
    console.log(summary.updateStatistics.nodesCreated())
  })
  .catch(function (error) {
    console.log(error)
  })
  .then(function () {
    promiseSession.close()
  })
