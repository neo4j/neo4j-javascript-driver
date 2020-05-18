/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
  let originalTimeout

  let consoleOverride
  let consoleOverridePromise
  let consoleOverridePromiseResolve

  const user = sharedNeo4j.username
  const password = sharedNeo4j.password
  const uri = 'bolt://localhost:7687'

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

    driverGlobal = neo4j.driver(uri, sharedNeo4j.authToken)
  })

  beforeEach(async () => {
    consoleOverridePromise = new Promise((resolve, reject) => {
      consoleOverridePromiseResolve = resolve
    })
    consoleOverride = { log: msg => consoleOverridePromiseResolve(msg) }

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(
      driverGlobal
    )
    edition = await sharedNeo4j.getEdition(driverGlobal)
  })

  afterAll(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
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
  })

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
  })

  it('basic auth example', async () => {
    // tag::basic-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
    // end::basic-auth[]

    await driver.verifyConnectivity()
    await driver.close()
  })

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
  })

  it('config connection timeout example', async () => {
    // tag::config-connection-timeout[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      connectionTimeout: 20 * 1000 // 20 seconds
    })
    // end::config-connection-timeout[]

    await driver.verifyConnectivity()
    await driver.close()
  })

  it('config max retry time example', async () => {
    // tag::config-max-retry-time[]
    const maxRetryTimeMs = 15 * 1000 // 15 seconds
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxTransactionRetryTime: maxRetryTimeMs
    })
    // end::config-max-retry-time[]

    await driver.verifyConnectivity()
    await driver.close()
  })

  it('config trust example', async () => {
    // tag::config-trust[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      encrypted: 'ENCRYPTION_ON',
      trust: 'TRUST_ALL_CERTIFICATES'
    })
    // end::config-trust[]

    await driver.verifyConnectivity()
    await driver.close()
  })

  it('config unencrypted example', async () => {
    // tag::config-unencrypted[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      encrypted: 'ENCRYPTION_OFF'
    })
    // end::config-unencrypted[]

    await driver.verifyConnectivity()
    await driver.close()
  })

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
  })
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
  })

  it('kerberos auth example', async () => {
    const ticket = 'a base64 encoded ticket'

    // tag::kerberos-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.kerberos(ticket))
    // end::kerberos-auth[]

    await driver.close()
  })

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

    expect(removeLineBreaks(await consoleLoggedMsg)).toBe(
      removeLineBreaks(
        "Invalid input 'L': expected 't/T' (line 1, column 3 (offset: 2))\n" +
          '"SELECT * FROM Employees WHERE name = $name"\n' +
          '   ^'
      )
    )
  })

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
  })

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
  })

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
  })

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
  })

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
  })

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
  })

  it('service unavailable example', done => {
    const console = consoleOverride
    const consoleLoggedMsg = consoleOverridePromise
    const uri = 'bolt://localhost:7688' // wrong port
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
  })

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
  })

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
  })

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
  })

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
  })

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
  })
})

function removeLineBreaks (string) {
  return string.replace(/(\r\n|\n|\r)/gm, ' ')
}
