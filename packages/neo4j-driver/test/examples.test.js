/**
 * Copyright (c) "Neo4j"
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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'
import { ServerVersion, VERSION_4_0_0 } from '../src/internal/server-version'
import { map, materialize, toArray } from 'rxjs/operators'
import { Notification } from 'rxjs'

/**
 * The tests below are examples that get pulled into the Driver Manual using the tags inside the tests.
 * Formatting of code here is important. Lines are rendered in manual and language guide web page as is.
 *
 * DO NOT add tests to this file that are not for that exact purpose.
 * DO NOT modify these tests without ensuring they remain consistent with the equivalent examples in other drivers
 */

describe('#integration examples', () => {
  const originalConsole = console

  let driverGlobal
  let protocolVersion
  let edition

  let consoleOverride
  let consoleOverridePromise
  let consoleOverridePromiseResolve
  let consoleOverridePromiseReject

  const user = sharedNeo4j.username
  const password = sharedNeo4j.password
  const uri = `bolt://${sharedNeo4j.hostname}:7687`

  beforeAll(() => {
    driverGlobal = neo4j.driver(uri, sharedNeo4j.authToken)
  })

  beforeEach(async () => {
    consoleOverridePromise = new Promise((resolve, reject) => {
      consoleOverridePromiseResolve = resolve
      consoleOverridePromiseReject = reject
    })
    consoleOverride = {
      log: msg => consoleOverridePromiseResolve(msg),
      error: msg => consoleOverridePromiseReject(msg)
    }

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(
      driverGlobal
    )
    edition = await sharedNeo4j.getEdition(driverGlobal)
  })

  afterAll(async () => {
    await driverGlobal.close()
  })

  // tag::autocommit-transaction[]
  // Not supported
  // end::autocommit-transaction[]
  it('async autocommit transaction example', async () => {
    const driver = driverGlobal

    const session = driver.session()
    try {
      await session.run('CREATE (p:Product) SET p.id = $id, p.title = $title', {
        id: 0,
        title: 'Product-0'
      })
    } finally {
      await session.close()
    }

    // tag::async-autocommit-transaction[]
    async function readProductTitles () {
      const session = driver.session()
      try {
        const result = await session.run(
          'MATCH (p:Product) WHERE p.id = $id RETURN p.title',
          {
            id: 0
          }
        )
        const records = result.records
        const titles = []
        for (let i = 0; i < records.length; i++) {
          const title = records[i].get(0)
          titles.push(title)
        }
        return titles
      } finally {
        await session.close()
      }
    }

    // end::async-autocommit-transaction[]

    const titles = await readProductTitles()
    expect(titles.length).toEqual(1)
    expect(titles[0]).toEqual('Product-0')
  }, 60000)

  it('rx autocommit transaction example', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const driver = driverGlobal
    const session = driver.session()
    try {
      await session.run('CREATE (p:Product) SET p.id = $id, p.title = $title', {
        id: 0,
        title: 'Product-0'
      })
    } finally {
      await session.close()
    }

    // tag::rx-autocommit-transaction[]
    function readProductTitles () {
      const session = driver.rxSession()
      return session
        .run('MATCH (p:Product) WHERE p.id = $id RETURN p.title', {
          id: 0
        })
        .records()
        .pipe(
          map(r => r.get(0)),
          materialize(),
          toArray()
        )
    }

    // end::rx-autocommit-transaction[]
    const result = await readProductTitles().toPromise()

    expect(result).toEqual([
      Notification.createNext('Product-0'),
      Notification.createComplete()
    ])
  }, 60000)

  it('basic auth example', async () => {
    // tag::basic-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
    // end::basic-auth[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  it('config connection pool example', async () => {
    // tag::config-connection-pool[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000 // 120 seconds
    })
    // end::config-connection-pool[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  it('config connection timeout example', async () => {
    // tag::config-connection-timeout[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      connectionTimeout: 20 * 1000 // 20 seconds
    })
    // end::config-connection-timeout[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  it('config max retry time example', async () => {
    // tag::config-max-retry-time[]
    const maxRetryTimeMs = 15 * 1000 // 15 seconds
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxTransactionRetryTime: maxRetryTimeMs
    })
    // end::config-max-retry-time[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  /// TODO: re-enable it
  xit('config trust example', async () => {
    // tag::config-trust[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      encrypted: 'ENCRYPTION_ON',
      trust: 'TRUST_ALL_CERTIFICATES'
    })
    // end::config-trust[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  it('config unencrypted example', async () => {
    // tag::config-unencrypted[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      encrypted: 'ENCRYPTION_OFF'
    })
    // end::config-unencrypted[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  /* eslint-disable no-unused-vars */
  it('config custom resolver example', done => {
    // tag::config-custom-resolver[]
    function createDriver (virtualUri, user, password, addresses) {
      return neo4j.driver(virtualUri, neo4j.auth.basic(user, password), {
        resolver: address => addresses
      })
    }

    function addPerson (name) {
      const driver = createDriver('neo4j://x.acme.com', user, password, [
        'a.acme.com:7575',
        'b.acme.com:7676',
        'c.acme.com:8787'
      ])
      const session = driver.session({ defaultAccessMode: neo4j.WRITE })

      session
        .run('CREATE (n:Person { name: $name })', { name: name })
        .then(() => session.close())
        .then(() => driver.close())
    }
    // end::config-custom-resolver[]

    done()
  }, 60000)
  /* eslint-enable no-unused-vars */

  it('custom auth example', async () => {
    const principal = user
    const credentials = password
    const realm = undefined
    const scheme = 'basic'
    const parameters = {}

    // tag::custom-auth[]
    const driver = neo4j.driver(
      uri,
      neo4j.auth.custom(principal, credentials, realm, scheme, parameters)
    )
    // end::custom-auth[]

    await driver.verifyConnectivity()
    await driver.close()
  }, 60000)

  it('kerberos auth example', async () => {
    const ticket = 'a base64 encoded ticket'

    // tag::kerberos-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.kerberos(ticket))
    // end::kerberos-auth[]

    await driver.close()
  }, 60000)

  it('bearer auth example', async () => {
    const token = 'a base64 encoded token'

    // tag::bearer-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.bearer(token))
    // end::bearer-auth[]

    await driver.close()
  }, 60000)

  it('cypher error example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const personName = 'Bob'

    // tag::cypher-error[]
    const session = driver.session()
    try {
      await session.readTransaction(tx =>
        tx.run('SELECT * FROM Employees WHERE name = $name', {
          name: personName
        })
      )
    } catch (error) {
      console.log(error.message)
    } finally {
      await session.close()
    }
    // end::cypher-error[]

    expect(
      removeLineBreaks(await consoleLoggedMsg)
        .toLowerCase()
        .startsWith('invalid input')
    ).toBeTruthy()
  }, 60000)

  it('driver lifecycle example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise

    // tag::driver-lifecycle[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))

    try {
      await driver.verifyConnectivity()
      console.log('Driver created')
    } catch (error) {
      console.log(`connectivity verification failed. ${error}`)
    }

    const session = driver.session()
    try {
      await session.run('CREATE (i:Item)')
    } catch (error) {
      console.log(`unable to execute query. ${error}`)
    } finally {
      await session.close()
    }

    // ... on application exit:
    await driver.close()
    // end::driver-lifecycle[]

    expect(await consoleLoggedMsg).toEqual('Driver created')
  }, 60000)

  it('hello world example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    // tag::hello-world[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
    const session = driver.session()

    try {
      const result = await session.writeTransaction(tx =>
        tx.run(
          'CREATE (a:Greeting) SET a.message = $message RETURN a.message + ", from node " + id(a)',
          { message: 'hello, world' }
        )
      )

      const singleRecord = result.records[0]
      const greeting = singleRecord.get(0)

      console.log(greeting)
    } finally {
      await session.close()
    }

    // on application exit:
    await driver.close()
    // end::hello-world[]

    expect(await consoleLoggedMsg).toContain('hello, world, from node')
  }, 60000)

  const require = () => {
    return neo4j
  }

  it('language guide page example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    // tag::language-guide-page[]
    const neo4j = require('neo4j-driver')

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
    const session = driver.session()
    const personName = 'Alice'

    try {
      const result = await session.run(
        'CREATE (a:Person {name: $name}) RETURN a',
        { name: personName }
      )

      const singleRecord = result.records[0]
      const node = singleRecord.get(0)

      console.log(node.properties.name)
    } finally {
      await session.close()
    }

    // on application exit:
    await driver.close()
    // end::language-guide-page[]

    expect(await consoleLoggedMsg).toEqual(personName)
  }, 60000)

  it('driver introduction example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise

    // tag::driver-introduction-example-imports[]
    const neo4j = require('neo4j-driver')
    // end::driver-introduction-example-imports[]

    // tag::driver-introduction-example-variables[]
    /*
    const uri = '%%BOLT_URL_PLACEHOLDER%%';
    const user = '<Username for Neo4j Aura database>';
    const password = '<Password for Neo4j Aura database>';
    */
    // end::driver-introduction-example-variables[]

    // tag::driver-introduction-example[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      // Enabling driver logging info into the console.
      // Supported levels: 'error', 'warn', 'info' and 'debug'
      logging: neo4j.logging.console('info')
    })
    const session = driver.session()

    const person1Name = 'Alice'
    const person2Name = 'David'
    const knowsFrom = 'School'

    try {
      // To learn more about the Cypher syntax, see https://neo4j.com/docs/cypher-manual/current/
      // The Reference Card is also a good resource for keywords https://neo4j.com/docs/cypher-refcard/current/
      const writeQuery = `MERGE (p1:Person { name: $person1Name })
                          MERGE (p2:Person { name: $person2Name })
                          MERGE (p1)-[k:KNOWS { from: $knowsFrom }]->(p2)
                          RETURN p1, p2, k`

      // Write transactions allow the driver to handle retries and transient errors
      const writeResult = await session.writeTransaction(tx =>
        tx.run(writeQuery, { person1Name, person2Name, knowsFrom })
      )
      writeResult.records.forEach(record => {
        const person1Node = record.get('p1')
        const person2Node = record.get('p2')
        const knowsRel = record.get('k')
        console.log(
          `Created friendship between: ${person1Node.properties.name}, ${person2Node.properties.name} from ${knowsRel.properties.from}`
        )
      })

      const readQuery = `MATCH (p:Person)
                         WHERE p.name = $personName
                         RETURN p.name AS name`
      const readResult = await session.readTransaction(tx =>
        tx.run(readQuery, { personName: person1Name })
      )
      readResult.records.forEach(record => {
        console.log(`Found person: ${record.get('name')}`)
      })
    } catch (error) {
      console.error(error)
    } finally {
      await session.close()
    }

    // Don't forget to close the driver connection when you're finished with it
    await driver.close()
    // end::driver-introduction-example[]

    expect(await consoleLoggedMsg).toEqual(
      `Created friendship between: ${person1Name}, ${person2Name} from ${knowsFrom}`
    )
  }, 60000)

  it('read write transaction example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const personName = 'Alice'

    // tag::read-write-transaction[]
    const session = driver.session()

    try {
      await session.writeTransaction(tx =>
        tx.run('CREATE (a:Person {name: $name})', { name: personName })
      )

      const result = await session.readTransaction(tx =>
        tx.run('MATCH (a:Person {name: $name}) RETURN id(a)', {
          name: personName
        })
      )

      const singleRecord = result.records[0]
      const createdNodeId = singleRecord.get(0)

      console.log('Matched created node with id: ' + createdNodeId)
    } finally {
      await session.close()
    }
    // end::read-write-transaction[]

    expect(await consoleLoggedMsg).toContain('Matched created node with id')
  }, 60000)

  // tag::result-consume[]
  // Not supported
  // end::result-consume[]
  it('async result consume example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const names = { nameA: 'Alice', nameB: 'Bob' }
    const tempSession = driver.session()
    try {
      await tempSession.run(
        'CREATE (a:Person {name: $nameA}), (b:Person {name: $nameB})',
        names
      )
    } finally {
      await tempSession.close()
    }
    // tag::async-result-consume[]
    const session = driver.session()
    const result = session.run('MATCH (a:Person) RETURN a.name ORDER BY a.name')
    const collectedNames = []

    result.subscribe({
      onNext: record => {
        const name = record.get(0)
        collectedNames.push(name)
      },
      onCompleted: () => {
        session.close().then(() => {
          console.log('Names: ' + collectedNames.join(', '))
        })
      },
      onError: error => {
        console.log(error)
      }
    })
    // end::async-result-consume[]

    expect(await consoleLoggedMsg).toEqual('Names: Alice, Bob')
  }, 60000)

  it('async multiple transactions', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const companyName = 'Acme'
    const personNames = { nameA: 'Alice', nameB: 'Bob' }
    const tmpSession = driver.session()

    try {
      await tmpSession.run(
        'CREATE (a:Person {name: $nameA}), (b:Person {name: $nameB})',
        personNames
      )

      // tag::async-multiple-tx[]
      const session = driver.session()
      try {
        const names = await session.readTransaction(async tx => {
          const result = await tx.run('MATCH (a:Person) RETURN a.name AS name')
          return result.records.map(record => record.get('name'))
        })

        const relationshipsCreated = await session.writeTransaction(tx =>
          Promise.all(
            names.map(name =>
              tx
                .run(
                  'MATCH (emp:Person {name: $person_name}) ' +
                    'MERGE (com:Company {name: $company_name}) ' +
                    'MERGE (emp)-[:WORKS_FOR]->(com)',
                  { person_name: name, company_name: companyName }
                )
                .then(
                  result =>
                    result.summary.counters.updates().relationshipsCreated
                )
                .then(relationshipsCreated =>
                  neo4j.int(relationshipsCreated).toInt()
                )
            )
          ).then(values => values.reduce((a, b) => a + b))
        )

        console.log(`Created ${relationshipsCreated} employees relationship`)
      } finally {
        await session.close()
      }
      // end::async-multiple-tx[]
    } finally {
      await tmpSession.close()
    }

    expect(await consoleLoggedMsg).toEqual('Created 2 employees relationship')
  })

  it('rx result consume example', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const driver = driverGlobal
    const names = { nameA: 'Alice', nameB: 'Bob' }
    const tempSession = driver.session()
    try {
      await tempSession.run(
        'CREATE (a:Person {name: $nameA}), (b:Person {name: $nameB})',
        names
      )
    } finally {
      await tempSession.close()
    }

    // tag::rx-result-consume[]
    const session = driver.rxSession()
    const result = session
      .run('MATCH (a:Person) RETURN a.name ORDER BY a.name')
      .records()
      .pipe(
        map(r => r.get(0)),
        materialize(),
        toArray()
      )
    // end::rx-result-consume[]

    const people = await result.toPromise()
    expect(people).toEqual([
      Notification.createNext('Alice'),
      Notification.createNext('Bob'),
      Notification.createComplete()
    ])
  }, 60000)

  // tag::result-retain[]
  // Not supported
  // end::result-retain[]
  it('result retain example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const companyName = 'Acme'
    const personNames = { nameA: 'Alice', nameB: 'Bob' }
    const tmpSession = driver.session()

    try {
      await tmpSession.run(
        'CREATE (a:Person {name: $nameA}), (b:Person {name: $nameB})',
        personNames
      )

      // tag::async-result-retain[]
      const session = driver.session()
      try {
        const result = await session.readTransaction(tx =>
          tx.run('MATCH (a:Person) RETURN a.name AS name')
        )

        const nameRecords = result.records
        for (let i = 0; i < nameRecords.length; i++) {
          const name = nameRecords[i].get('name')

          await session.writeTransaction(tx =>
            tx.run(
              'MATCH (emp:Person {name: $person_name}) ' +
                'MERGE (com:Company {name: $company_name}) ' +
                'MERGE (emp)-[:WORKS_FOR]->(com)',
              { person_name: name, company_name: companyName }
            )
          )
        }

        console.log(`Created ${nameRecords.length} employees`)
      } finally {
        await session.close()
      }
      // end::async-result-retain[]
    } finally {
      await tmpSession.close()
    }

    expect(await consoleLoggedMsg).toEqual('Created 2 employees')
  }, 60000)

  it('service unavailable example', done => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const uri = `bolt://${sharedNeo4j.hostname}:7688` // wrong port
    const password = 'wrongPassword'

    // tag::service-unavailable[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxTransactionRetryTime: 3000
    })
    const session = driver.session()

    const writeTxPromise = session.writeTransaction(tx =>
      tx.run('CREATE (a:Item)')
    )

    writeTxPromise.catch(error => {
      if (error.code === neo4j.error.SERVICE_UNAVAILABLE) {
        console.log('Unable to create node: ' + error.code)
      }
    })
    // end::service-unavailable[]

    consoleLoggedMsg
      .then(loggedMsg => {
        expect(loggedMsg).toBe(
          'Unable to create node: ' + neo4j.error.SERVICE_UNAVAILABLE
        )
      })
      .then(() => driver.close())
      .then(() => done())
  }, 60000)

  it('session example', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const personName = 'Alice'

    // tag::session[]
    const session = driver.session()

    try {
      await session.run('CREATE (a:Person {name: $name})', { name: personName })
      console.log('Person created, session closed')
    } finally {
      await session.close()
    }
    // end::session[]

    expect(await consoleLoggedMsg).toBe('Person created, session closed')
  }, 60000)

  // tag::transaction-function[]
  // Not supported
  // end::transaction-function[]
  it('async transaction function example', async () => {
    const driver = driverGlobal
    const tempSession = driver.session()
    try {
      await tempSession.run(
        "UNWIND ['Infinity Gauntlet', 'Mjölnir'] AS item " +
          'CREATE (:Product {id: 0, title: item})'
      )
    } finally {
      await tempSession.close()
    }

    // tag::async-transaction-function[]
    const session = driver.session()
    const titles = []
    try {
      const result = await session.readTransaction(tx =>
        tx.run('MATCH (p:Product) WHERE p.id = $id RETURN p.title', { id: 0 })
      )

      const records = result.records
      for (let i = 0; i < records.length; i++) {
        const title = records[i].get(0)
        titles.push(title)
      }
    } finally {
      await session.close()
    }
    // end::async-transaction-function[]

    expect(titles.length).toEqual(2)
    expect(titles.includes('Infinity Gauntlet')).toBeTruthy()
    expect(titles.includes('Mjölnir')).toBeTruthy()
  }, 60000)

  it('rx transaction function example', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const driver = driverGlobal
    const tempSession = driver.session()
    try {
      await tempSession.run(
        "UNWIND ['Infinity Gauntlet', 'Mjölnir'] AS item " +
          'CREATE (:Product {id: 0, title: item})'
      )
    } finally {
      await tempSession.close()
    }

    // tag::rx-transaction-function[]
    const session = driver.rxSession()
    const result = session.readTransaction(tx =>
      tx
        .run('MATCH (p:Product) WHERE p.id = $id RETURN p.title', { id: 0 })
        .records()
        .pipe(
          map(r => r.get(0)),
          materialize(),
          toArray()
        )
    )
    // end::rx-transaction-function[]

    const people = await result.toPromise()
    expect(people).toEqual([
      Notification.createNext('Infinity Gauntlet'),
      Notification.createNext('Mjölnir'),
      Notification.createComplete()
    ])
  }, 60000)

  it('configure transaction timeout', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const personName = 'Antonio'

    // Create a person node
    function addPerson (tx, name) {
      return tx.run('CREATE (a:Person {name: $name}) RETURN a', { name: name })
    }

    // tag::transaction-timeout-config[]
    const session = driver.session()
    try {
      const result = await session.writeTransaction(
        tx => addPerson(tx, personName),
        { timeout: 10 }
      )

      const singleRecord = result.records[0]
      const createdNodeId = singleRecord.get(0)

      console.log('Created node with id: ' + createdNodeId)
    } finally {
      await session.close()
    }
    // end::transaction-timeout-config[]
    expect(await consoleLoggedMsg).toContain('Created node with id')
  }, 60000)

  it('configure transaction metadata', async () => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const driver = driverGlobal
    const personName = 'Antonio'

    // Create a person node
    function addPerson (tx, name) {
      return tx.run('CREATE (a:Person {name: $name}) RETURN a', { name: name })
    }

    // tag::transaction-metadata-config[]
    const session = driver.session()
    try {
      const result = await session.writeTransaction(
        tx => addPerson(tx, personName),
        { metadata: { applicationId: '123' } }
      )

      const singleRecord = result.records[0]
      const createdNodeId = singleRecord.get(0)

      console.log('Created node with id: ' + createdNodeId)
    } finally {
      await session.close()
    }
    // end::transaction-metadata-config[]
    expect(await consoleLoggedMsg).toContain('Created node with id')
  }, 60000)

  it('use another database example', async () => {
    if (protocolVersion < 4.0 || edition !== 'enterprise') {
      return
    }

    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise

    const driver = driverGlobal
    const systemSession = driver.session({ database: 'system' })
    try {
      await systemSession.run('DROP DATABASE examples')
    } catch (err) {
      // Database probably didn't exists
    }

    try {
      await systemSession.run('CREATE DATABASE examples')
    } finally {
      await systemSession.close()
    }

    // tag::database-selection[]
    const session = driver.session({ database: 'examples' })
    try {
      const result = await session.writeTransaction(tx =>
        tx.run(
          'CREATE (a:Greeting {message: "Hello, Example-Database"}) RETURN a.message'
        )
      )

      const singleRecord = result.records[0]
      const greeting = singleRecord.get(0)

      console.log(greeting)
    } finally {
      await session.close()
    }

    const readSession = driver.session({
      database: 'examples',
      defaultAccessMode: neo4j.READ
    })
    try {
      const result = await readSession.writeTransaction(tx =>
        tx.run('MATCH (a:Greeting) RETURN a.message')
      )

      const singleRecord = result.records[0]
      const greeting = singleRecord.get(0)

      console.log(greeting)
    } finally {
      await readSession.close()
    }
    // end::database-selection[]

    expect(await consoleLoggedMsg).toContain('Hello, Example-Database')
  }, 60000)

  it('pass bookmarks example', done => {
    const driver = driverGlobal

    // tag::pass-bookmarks[]
    // Create a company node
    function addCompany (tx, name) {
      return tx.run('CREATE (a:Company {name: $name})', { name: name })
    }

    // Create a person node
    function addPerson (tx, name) {
      return tx.run('CREATE (a:Person {name: $name})', { name: name })
    }

    // Create an employment relationship to a pre-existing company node.
    // This relies on the person first having been created.
    function addEmployee (tx, personName, companyName) {
      return tx.run(
        'MATCH (person:Person {name: $personName}) ' +
          'MATCH (company:Company {name: $companyName}) ' +
          'CREATE (person)-[:WORKS_FOR]->(company)',
        { personName: personName, companyName: companyName }
      )
    }

    // Create a friendship between two people.
    function makeFriends (tx, name1, name2) {
      return tx.run(
        'MATCH (a:Person {name: $name1}) ' +
          'MATCH (b:Person {name: $name2}) ' +
          'MERGE (a)-[:KNOWS]->(b)',
        { name1: name1, name2: name2 }
      )
    }

    // To collect friend relationships
    const friends = []

    // Match and display all friendships.
    function findFriendships (tx) {
      const result = tx.run('MATCH (a)-[:KNOWS]->(b) RETURN a.name, b.name')

      result.subscribe({
        onNext: record => {
          const name1 = record.get(0)
          const name2 = record.get(1)

          friends.push({ name1: name1, name2: name2 })
        }
      })
    }

    // To collect the session bookmarks
    const savedBookmarks = []

    // Create the first person and employment relationship.
    const session1 = driver.session({ defaultAccessMode: neo4j.WRITE })
    const first = session1
      .writeTransaction(tx => addCompany(tx, 'Wayne Enterprises'))
      .then(() => session1.writeTransaction(tx => addPerson(tx, 'Alice')))
      .then(() =>
        session1.writeTransaction(tx =>
          addEmployee(tx, 'Alice', 'Wayne Enterprises')
        )
      )
      .then(() => {
        savedBookmarks.push(session1.lastBookmark())
      })
      .then(() => session1.close())

    // Create the second person and employment relationship.
    const session2 = driver.session({ defaultAccessMode: neo4j.WRITE })
    const second = session2
      .writeTransaction(tx => addCompany(tx, 'LexCorp'))
      .then(() => session2.writeTransaction(tx => addPerson(tx, 'Bob')))
      .then(() =>
        session2.writeTransaction(tx => addEmployee(tx, 'Bob', 'LexCorp'))
      )
      .then(() => {
        savedBookmarks.push(session2.lastBookmark())
      })
      .then(() => session2.close())

    // Create a friendship between the two people created above.
    const last = Promise.all([first, second]).then(() => {
      const session3 = driver.session({
        defaultAccessMode: neo4j.WRITE,
        bookmarks: savedBookmarks
      })

      return session3
        .writeTransaction(tx => makeFriends(tx, 'Alice', 'Bob'))
        .then(() =>
          session3.readTransaction(findFriendships).then(() => session3.close())
        )
    })
    // end::pass-bookmarks[]

    last.then(() => {
      expect(friends.length).toBe(1)
      expect(friends[0].name1).toBe('Alice')
      expect(friends[0].name2).toBe('Bob')

      done()
    })
  }, 60000)

  describe('temporal types examples', () => {
    it('Duration', async () => {
      const driver = driverGlobal
      const session = driver.session()

      try {
        // tag::temporal-types-duration[]
        // Creating the Duration object
        const duration = new neo4j.types.Duration(
          3, // month
          5, // days
          7, // seconds
          11 // nano seconds
        )
        // end::temporal-types-duration[]

        const result = await session.run('RETURN $duration as fieldName', {
          duration
        })

        const record = result.records[0]

        // tag::temporal-types-duration[]

        // Getting Duration field from record
        const durationField = record.get('fieldName')

        // Verifying if object is a Duration
        neo4j.isDuration(durationField) // true

        // Serializing as ISO String
        durationField.toString() // P3M5DT7.000000011S
        // end::temporal-types-duration[]

        expect(neo4j.isDuration(durationField)).toEqual(true)
        expect(durationField.months.toInt()).toEqual(duration.months)
        expect(durationField.days.toInt()).toEqual(duration.days)
        expect(durationField.seconds).toEqual(duration.seconds)
        expect(durationField.nanoseconds).toEqual(duration.nanoseconds)
      } finally {
        await session.close()
      }
    }, 30000)

    it('LocalTime', async () => {
      const driver = driverGlobal
      const session = driver.session()
      const standardDate = new Date()

      try {
        // tag::temporal-types-localtime[]
        // Creating LocalTime from standard javascript Date.
        // Alternatively, the LocalTime could be created with
        // new neo4j.types.LocalTime(hour, minute, second, nanosecond)
        const localTime = neo4j.types.LocalTime.fromStandardDate(
          standardDate,
          200 // nanosecond (optional)
        )
        // end::temporal-types-localtime[]

        const result = await session.run('RETURN $localTime as fieldName', {
          localTime
        })

        const record = result.records[0]

        // tag::temporal-types-localtime[]

        // Getting LocalTime field from record
        const fieldLocalTime = record.get('fieldName')

        // Verifying if object is a LocalTime
        neo4j.isLocalTime(fieldLocalTime) // true

        // Serializing as ISO String
        fieldLocalTime.toString() // 13:40:38.539000200
        // end::temporal-types-localtime[]

        expect(neo4j.isLocalTime(fieldLocalTime)).toBe(true)
        expect(fieldLocalTime.hour.toInt()).toEqual(localTime.hour)
        expect(fieldLocalTime.minute.toInt()).toEqual(localTime.minute)
        expect(fieldLocalTime.second.toInt()).toEqual(localTime.second)
        expect(fieldLocalTime.nanosecond.toInt()).toEqual(localTime.nanosecond)
      } finally {
        await session.close()
      }
    }, 30000)

    it('Time', async () => {
      const driver = driverGlobal
      const session = driver.session()
      const standardDate = new Date()

      try {
        // tag::temporal-types-time[]
        // Creating Time from standard javascript Date.
        // Alternatively, the Time could be created with
        // new neo4j.types.Time(hour, minute, second, nanosecond, timeZoneOffsetSeconds)
        const time = neo4j.types.Time.fromStandardDate(
          standardDate,
          200 // nanosecond (optional)
        )
        // end::temporal-types-time[]

        const result = await session.run('RETURN $time as fieldName', { time })

        const record = result.records[0]

        // tag::temporal-types-time[]

        // Getting Time field from record
        const fieldTime = record.get('fieldName')

        // Verifying if object is a Time
        neo4j.isTime(fieldTime) // true

        // Serializing as ISO String
        fieldTime.toString() // 13:39:08.529000200+02:00
        // end::temporal-types-time[]

        expect(neo4j.isTime(fieldTime)).toBe(true)
        expect(fieldTime.hour.toInt()).toEqual(time.hour)
        expect(fieldTime.minute.toInt()).toEqual(time.minute)
        expect(fieldTime.second.toInt()).toEqual(time.second)
        expect(fieldTime.nanosecond.toInt()).toEqual(time.nanosecond)
        expect(fieldTime.timeZoneOffsetSeconds.toInt()).toEqual(
          time.timeZoneOffsetSeconds
        )
      } finally {
        await session.close()
      }
    }, 30000)

    it('Date', async () => {
      const driver = driverGlobal
      const session = driver.session()
      const standardDate = new Date()

      try {
        // tag::temporal-types-date[]
        // Creating Date from standard javascript Date.
        // Alternatively, the Date could be created with
        // new neo4j.types.Date(year, month, day)
        const date = neo4j.types.Date.fromStandardDate(standardDate)
        // end::temporal-types-date[]

        const result = await session.run('RETURN $date as fieldName', { date })

        const record = result.records[0]

        // tag::temporal-types-date[]

        // Getting Date field from record
        const fieldDate = record.get('fieldName')

        // Verifying if object is a Date
        neo4j.isDate(fieldDate) // true

        // Serializing as ISO String
        fieldDate.toString() // 2021-06-07
        // end::temporal-types-date[]

        expect(neo4j.isDate(fieldDate)).toBe(true)
        expect(fieldDate.year.toInt()).toEqual(date.year)
        expect(fieldDate.month.toInt()).toEqual(date.month)
        expect(fieldDate.day.toInt()).toEqual(date.day)
      } finally {
        await session.close()
      }
    }, 30000)

    it('LocalDateTime', async () => {
      const driver = driverGlobal
      const session = driver.session()
      const standardDate = new Date()

      try {
        // tag::temporal-types-localdatetime[]
        // Creating LocalDateTime from standard javascript Date.
        // Alternatively, the LocalDateTime could be created with
        // new neo4j.types.LocalDateTime(year, month, day, hour, minute, second, nanosecond)
        const localDateTime = neo4j.types.LocalDateTime.fromStandardDate(
          standardDate,
          200 // nanosecond (optional)
        )
        // end::temporal-types-localdatetime[]

        const result = await session.run('RETURN $localDateTime as fieldName', {
          localDateTime
        })

        const record = result.records[0]

        // tag::temporal-types-localdatetime[]

        // Getting LocalDateTime field from record
        const fieldLocalDateTime = record.get('fieldName')

        // Verifying if object is a LocalDateTime
        neo4j.isLocalDateTime(fieldLocalDateTime) // true

        // Serializing as ISO String
        fieldLocalDateTime.toString() // 2021-06-07T13:35:46.344000200
        // end::temporal-types-localdatetime[]

        expect(neo4j.isLocalDateTime(fieldLocalDateTime)).toBe(true)
        expect(fieldLocalDateTime.year.toInt()).toEqual(localDateTime.year)
        expect(fieldLocalDateTime.month.toInt()).toEqual(localDateTime.month)
        expect(fieldLocalDateTime.day.toInt()).toEqual(localDateTime.day)
        expect(fieldLocalDateTime.hour.toInt()).toEqual(localDateTime.hour)
        expect(fieldLocalDateTime.minute.toInt()).toEqual(localDateTime.minute)
        expect(fieldLocalDateTime.second.toInt()).toEqual(localDateTime.second)
        expect(fieldLocalDateTime.nanosecond.toInt()).toEqual(
          localDateTime.nanosecond
        )
      } finally {
        await session.close()
      }
    }, 30000)

    it('DateTime', async () => {
      const driver = driverGlobal
      const session = driver.session()
      const standardDate = new Date()

      try {
        // tag::temporal-types-datetime[]
        // Creating DateTime from standard javascript Date.
        // Alternatively, the DateTime could be created with
        // new neo4j.types.DateTime(year, month, day, hour, minute, second, nanosecond, timeZoneOffsetSeconds)
        const dateTime = neo4j.types.DateTime.fromStandardDate(
          standardDate,
          200 // nanosecond (optional)
        )
        // end::temporal-types-datetime[]

        const result = await session.run('RETURN $dateTime as fieldName', {
          dateTime
        })

        const record = result.records[0]

        // tag::temporal-types-datetime[]

        // Getting DateTime field from record
        const fieldDateTime = record.get('fieldName')

        // Verifying if object is a DateTime
        neo4j.isDateTime(fieldDateTime) // true

        // Serializing as ISO String
        fieldDateTime.toString() // 2021-06-07T13:33:48.788000200+02:00
        // end::temporal-types-datetime[]

        expect(neo4j.isDateTime(fieldDateTime)).toBe(true)
        expect(fieldDateTime.year.toInt()).toEqual(dateTime.year)
        expect(fieldDateTime.month.toInt()).toEqual(dateTime.month)
        expect(fieldDateTime.day.toInt()).toEqual(dateTime.day)
        expect(fieldDateTime.hour.toInt()).toEqual(dateTime.hour)
        expect(fieldDateTime.minute.toInt()).toEqual(dateTime.minute)
        expect(fieldDateTime.second.toInt()).toEqual(dateTime.second)
        expect(fieldDateTime.nanosecond.toInt()).toEqual(dateTime.nanosecond)
        expect(fieldDateTime.timeZoneOffsetSeconds.toInt()).toEqual(
          dateTime.timeZoneOffsetSeconds
        )
      } finally {
        await session.close()
      }
    }, 30000)
  })

  describe('geospartial types examples', () => {
    describe('Point', () => {
      it('Cartesian', async () => {
        const console = jasmine.createSpyObj('console', ['log'])
        const driver = driverGlobal
        const session = driver.session()

        try {
          // tag::geospatial-types-cartesian[]
          // Creating a 2D point in Cartesian space
          const point2d = new neo4j.types.Point(
            7203, // SRID
            1, // x
            5.1 // y
          )

          //  Or in 3D
          const point3d = new neo4j.types.Point(
            9157, // SRID
            1, // x
            -2, // y
            3.1 // z
          )
          // end::geospatial-types-cartesian[]

          const recordWith2dPoint = await echo(session, point2d)
          const recordWith3dPoint = await echo(session, point3d)

          // tag::geospatial-types-cartesian[]

          // Reading a 2D point from a record
          const fieldPoint2d = recordWith2dPoint.get('fieldName')

          // Serializing
          fieldPoint2d.toString() // Point{srid=7203, x=1.0, y=5.1}

          // Accessing fields
          console.log(
            `Point with x=${fieldPoint2d.x}, y=${fieldPoint2d.y}, srid=${fieldPoint2d.srid}`
          )

          // Verifiying if object is a Pojnt
          neo4j.isPoint(fieldPoint2d) // true

          // Readning a 3D point from a record
          const fieldPoint3d = recordWith3dPoint.get('fieldName')

          // Serializing
          fieldPoint3d.toString() // Point{srid=9157, x=1.0, y=-2.0, z=3.1}

          // Accessing fields
          console.log(
            `Point with x=${fieldPoint3d.x}, y=${fieldPoint3d.y}, z=${fieldPoint3d.z}, srid=${fieldPoint3d.srid}`
          )

          // Verifiying if object is a Pojnt
          neo4j.isPoint(fieldPoint3d) // true
          // end::geospatial-types-cartesian[]

          expect(neo4j.isPoint(fieldPoint2d)).toBe(true)
          expect(fieldPoint2d.x).toBe(point2d.x)
          expect(fieldPoint2d.y).toBe(point2d.y)
          expect(fieldPoint2d.z).toBe(point2d.z)
          expect(fieldPoint2d.toString()).toEqual(
            'Point{srid=7203, x=1.0, y=5.1}'
          )
          expect(console.log).toHaveBeenCalledWith(
            'Point with x=1, y=5.1, srid=7203'
          )
          expect(fieldPoint2d.srid.toInt()).toBe(Number(point2d.srid))

          expect(neo4j.isPoint(fieldPoint3d)).toBe(true)
          expect(fieldPoint3d.x).toBe(point3d.x)
          expect(fieldPoint3d.y).toBe(point3d.y)
          expect(fieldPoint3d.z).toBe(point3d.z)
          expect(fieldPoint3d.toString()).toEqual(
            'Point{srid=9157, x=1.0, y=-2.0, z=3.1}'
          )
          expect(console.log).toHaveBeenCalledWith(
            'Point with x=1, y=-2, z=3.1, srid=9157'
          )
          expect(fieldPoint3d.srid.toInt()).toBe(Number(point3d.srid))
        } finally {
          await session.close()
        }
      })

      it('WGS84', async () => {
        const console = jasmine.createSpyObj('console', ['log'])
        const driver = driverGlobal
        const session = driver.session()

        try {
          // tag::geospatial-types-wgs84[]
          // Creating a 2D point in WGS84 space
          const point2d = new neo4j.types.Point(
            4326, // SRID
            1, // x
            5.1 // y
          )

          //  Or in 3D
          const point3d = new neo4j.types.Point(
            4979, // SRID
            1, // x
            -2, // y
            3.1 // z
          )
          // end::geospatial-types-wgs84[]

          const recordWith2dPoint = await echo(session, point2d)
          const recordWith3dPoint = await echo(session, point3d)

          // tag::geospatial-types-wgs84[]

          // Reading a 2D point from a record
          const fieldPoint2d = recordWith2dPoint.get('fieldName')

          // Serializing
          fieldPoint2d.toString() // Point{srid=4326, x=1.0, y=5.1}

          // Accessing fields
          console.log(
            `Point with x=${fieldPoint2d.x}, y=${fieldPoint2d.y}, srid=${fieldPoint2d.srid}`
          )

          // Verifiying if object is a Pojnt
          neo4j.isPoint(fieldPoint2d) // true

          // Readning a 3D point from a record
          const fieldPoint3d = recordWith3dPoint.get('fieldName')

          // Serializing
          fieldPoint3d.toString() // Point{srid=4979, x=1.0, y=-2.0, z=3.1}

          // Accessing fields
          console.log(
            `Point with x=${fieldPoint3d.x}, y=${fieldPoint3d.y}, z=${fieldPoint3d.z}, srid=${fieldPoint3d.srid}`
          )

          // Verifiying if object is a Pojnt
          neo4j.isPoint(fieldPoint3d) // true
          // end::geospatial-types-wgs84[]

          expect(neo4j.isPoint(fieldPoint2d)).toBe(true)
          expect(fieldPoint2d.x).toBe(point2d.x)
          expect(fieldPoint2d.y).toBe(point2d.y)
          expect(fieldPoint2d.z).toBe(point2d.z)
          expect(fieldPoint2d.toString()).toEqual(
            'Point{srid=4326, x=1.0, y=5.1}'
          )
          expect(console.log).toHaveBeenCalledWith(
            'Point with x=1, y=5.1, srid=4326'
          )
          expect(fieldPoint2d.srid.toInt()).toBe(Number(point2d.srid))

          expect(neo4j.isPoint(fieldPoint3d)).toBe(true)
          expect(fieldPoint3d.x).toBe(point3d.x)
          expect(fieldPoint3d.y).toBe(point3d.y)
          expect(fieldPoint3d.z).toBe(point3d.z)
          expect(fieldPoint3d.toString()).toEqual(
            'Point{srid=4979, x=1.0, y=-2.0, z=3.1}'
          )
          expect(console.log).toHaveBeenCalledWith(
            'Point with x=1, y=-2, z=3.1, srid=4979'
          )
          expect(fieldPoint3d.srid.toInt()).toBe(Number(point3d.srid))
        } finally {
          await session.close()
        }
      })
    })

    async function echo (session, value) {
      return await session.readTransaction(async tx => {
        const result = await tx.run('RETURN $value as fieldName', {
          value
        })
        return result.records[0]
      })
    }
  })
})

function removeLineBreaks (string) {
  return string.replace(/(\r\n|\n|\r)/gm, ' ')
}
