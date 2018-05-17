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

import neo4j from '../../src/v1';
import sharedNeo4j from '../internal/shared-neo4j';

/**
 * The tests below are examples that get pulled into the Driver Manual using the tags inside the tests.
 * Formatting of code here is important. Lines are rendered in manual and language guide web page as is.
 *
 * DO NOT add tests to this file that are not for that exact purpose.
 * DO NOT modify these tests without ensuring they remain consistent with the equivalent examples in other drivers
 */
describe('examples', () => {

  const neo4jV1 = neo4j;

  let driverGlobal;
  let console;
  let originalTimeout;

  let testResultPromise;
  let resolveTestResultPromise;

  const user = sharedNeo4j.username;
  const password = sharedNeo4j.password;
  const uri = 'bolt://localhost:7687';

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

    driverGlobal = neo4j.driver(uri, sharedNeo4j.authToken);
  });

  beforeEach(done => {

    testResultPromise = new Promise((resolve, reject) => {
      resolveTestResultPromise = resolve;
    });

    // Override console.log, to assert on stdout output
    console = {log: resolveTestResultPromise};

    const session = driverGlobal.session();
    session.run('MATCH (n) DETACH DELETE n').then(() => {
      session.close(() => {
        done();
      });
    });
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    driverGlobal.close();
  });

  it('autocommit transaction example', done => {
    const driver = driverGlobal;

    // tag::autocommit-transaction[]
    function addPerson(name) {
      const session = driver.session();
      return session.run('CREATE (a:Person {name: $name})', {name: name}).then(result => {
        session.close();
        return result;
      });
    }

    // end::autocommit-transaction[]

    addPerson('Alice').then(() => {
      const session = driver.session();
      session.run('MATCH (a:Person {name: $name}) RETURN count(a) AS result', {name: 'Alice'}).then(result => {
        session.close(() => {
          expect(result.records[0].get('result').toInt()).toEqual(1);
          done();
        });
      });
    });
  });

  it('basic auth example', done => {
    // tag::basic-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    // end::basic-auth[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('config connection pool example', done => {
    // tag::config-connection-pool[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password),
      {
        maxConnectionLifetime: 30*60*60,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2*60
      }
    );
    // end::config-connection-pool[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('config load balancing example', done => {
    // tag::config-load-balancing-strategy[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password),
      {
        loadBalancingStrategy: "least_connected"
      }
    );
    // end::config-load-balancing-strategy[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('config max retry time example', done => {
    // tag::config-max-retry-time[]
    const maxRetryTimeMs = 15 * 1000; // 15 seconds
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password),
      {
        maxTransactionRetryTime: maxRetryTimeMs
      }
    );
    // end::config-max-retry-time[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('config trust example', done => {
    // tag::config-trust[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password),
      {
        encrypted: 'ENCRYPTION_ON',
        trust: 'TRUST_ALL_CERTIFICATES'
      }
    );
    // end::config-trust[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('config unencrypted example', done => {
    // tag::config-unencrypted[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password),
      {
        encrypted: 'ENCRYPTION_OFF'
      }
    );
    // end::config-unencrypted[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('custom auth example', done => {
    const principal = user;
    const credentials = password;
    const realm = undefined;
    const scheme = 'basic';
    const parameters = {};

    // tag::custom-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.custom(principal, credentials, realm, scheme, parameters));
    // end::custom-auth[]

    driver.onCompleted = () => {
      driver.close();
      done();
    };
  });

  it('kerberos auth example', () => {
    const ticket = 'a base64 encoded ticket';

    // tag::kerberos-auth[]
    const driver = neo4j.driver(uri, neo4j.auth.kerberos(ticket));
    // end::kerberos-auth[]

    driver.close();
  });

  it('cypher error example', done => {
    const driver = driverGlobal;
    const personName = 'Bob';

    // tag::cypher-error[]
    const session = driver.session();

    const readTxPromise = session.readTransaction(tx => tx.run('SELECT * FROM Employees WHERE name = $name', {name: personName}));

    readTxPromise.catch(error => {
      session.close();
      console.log(error.message);
    });
    // end::cypher-error[]

    testResultPromise.then(loggedMsg => {
      expect(removeLineBreaks(loggedMsg)).toBe(removeLineBreaks(
        'Invalid input \'L\': expected \'t/T\' (line 1, column 3 (offset: 2))\n' +
        '"SELECT * FROM Employees WHERE name = $name"\n' +
        '   ^'));
      done();
    });
  });

  it('driver lifecycle example', done => {
    // tag::driver-lifecycle[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

    driver.onCompleted = () => {
      console.log('Driver created');
    };

    driver.onError = error => {
      console.log(error);
    };

    const session = driver.session();
    session.run('CREATE (i:Item)').then(() => {
      session.close();

      // ... on application exit:
      driver.close();
    });
    // end::driver-lifecycle[]

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg).toEqual('Driver created');
      done();
    });
  });

  it('hello world example', done => {
    // tag::hello-world[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const session = driver.session();

    const resultPromise = session.writeTransaction(tx => tx.run(
      'CREATE (a:Greeting) SET a.message = $message RETURN a.message + ", from node " + id(a)',
      {message: 'hello, world'}));

    resultPromise.then(result => {
      session.close();

      const singleRecord = result.records[0];
      const greeting = singleRecord.get(0);

      console.log(greeting);

      // on application exit:
      driver.close();
    });
    // end::hello-world[]

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg.indexOf('hello, world, from node') === 0).toBeTruthy();
      done();
    });
  });

  it('language guide page example', done => {
    const require = () => {
      return {v1: neo4jV1};
    };

    // tag::language-guide-page[]
    const neo4j = require('neo4j-driver').v1;

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const session = driver.session();

    const personName = 'Alice';
    const resultPromise = session.run(
      'CREATE (a:Person {name: $name}) RETURN a',
      {name: personName}
    );

    resultPromise.then(result => {
      session.close();

      const singleRecord = result.records[0];
      const node = singleRecord.get(0);

      console.log(node.properties.name);

      // on application exit:
      driver.close();
    });
    // end::language-guide-page[]

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg).toEqual(personName);
      done();
    });
  });

  it('read write transaction example', done => {
    const driver = driverGlobal;
    const personName = 'Alice';

    // tag::read-write-transaction[]
    const session = driver.session();

    const writeTxPromise = session.writeTransaction(tx => tx.run('CREATE (a:Person {name: $name})', {name: personName}));

    writeTxPromise.then(() => {
      const readTxPromise = session.readTransaction(tx => tx.run('MATCH (a:Person {name: $name}) RETURN id(a)', {name: personName}));

      readTxPromise.then(result => {
        session.close();

        const singleRecord = result.records[0];
        const createdNodeId = singleRecord.get(0);

        console.log('Matched created node with id: ' + createdNodeId);
      });
    });
    // end::read-write-transaction[]

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg.indexOf('Matched created node with id') === 0).toBeTruthy();
      done();
    });
  });

  it('result consume example', done => {
    const driver = driverGlobal;
    const names = {nameA: 'Alice', nameB: 'Bob'};
    const tmpSession = driver.session();

    tmpSession.run('CREATE (a:Person {name: $nameA}), (b:Person {name: $nameB})', names).then(() => {
      tmpSession.close(() => {

        // tag::result-consume[]
        const session = driver.session();
        const result = session.run('MATCH (a:Person) RETURN a.name ORDER BY a.name');
        const collectedNames = [];

        result.subscribe({
          onNext: record => {
            const name = record.get(0);
            collectedNames.push(name);
          },
          onCompleted: () => {
            session.close();

            console.log('Names: ' + collectedNames.join(', '));
          },
          onError: error => {
            console.log(error);
          }
        });
        // end::result-consume[]
      });
    });

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg).toEqual('Names: Alice, Bob');
      done();
    });
  });

  it('result retain example', done => {
    const driver = driverGlobal;
    const companyName = 'Acme';
    const personNames = {nameA: 'Alice', nameB: 'Bob'};
    const tmpSession = driver.session();

    tmpSession.run('CREATE (a:Person {name: $nameA}), (b:Person {name: $nameB})', personNames).then(() => {
      tmpSession.close(() => {

        // tag::result-retain[]
        const session = driver.session();

        const readTxPromise = session.readTransaction(tx => tx.run('MATCH (a:Person) RETURN a.name AS name'));

        const addEmployeesPromise = readTxPromise.then(result => {
          const nameRecords = result.records;

          let writeTxsPromise = Promise.resolve();
          for (let i = 0; i < nameRecords.length; i++) {
            const name = nameRecords[i].get('name');

            writeTxsPromise = writeTxsPromise.then(() =>
              session.writeTransaction(tx =>
                tx.run(
                  'MATCH (emp:Person {name: $person_name}) ' +
                  'MERGE (com:Company {name: $company_name}) ' +
                  'MERGE (emp)-[:WORKS_FOR]->(com)',
                  {'person_name': name, 'company_name': companyName})));
          }

          return writeTxsPromise.then(() => nameRecords.length);
        });

        addEmployeesPromise.then(employeesCreated => {
          session.close();
          console.log('Created ' + employeesCreated + ' employees');
        });
        // end::result-retain[]
      });
    });

    testResultPromise.then(loggedMsg => {
      driver.close();
      expect(loggedMsg).toEqual('Created 2 employees');
      done();
    });
  });

  it('service unavailable example', done => {
    const uri = 'bolt://localhost:7688'; // wrong port
    const password = 'wrongPassword';

    // tag::service-unavailable[]
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {maxTransactionRetryTime: 3000});
    const session = driver.session();

    const writeTxPromise = session.writeTransaction(tx => tx.run('CREATE (a:Item)'));

    writeTxPromise.catch(error => {
      if (error.code === neo4j.error.SERVICE_UNAVAILABLE) {
        console.log('Unable to create node: ' + error.code);
      }
    });
    // end::service-unavailable[]

    testResultPromise.then(loggedMsg => {
      driver.close();
      expect(loggedMsg).toBe('Unable to create node: ' + neo4j.error.SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('session example', done => {
    const driver = driverGlobal;
    const personName = 'Alice';

    // tag::session[]
    const session = driver.session();

    session.run('CREATE (a:Person {name: $name})', {'name': personName}).then(() => {
      session.close(() => {
        console.log('Person created, session closed');
      });
    });
    // end::session[]

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg).toBe('Person created, session closed');
      done();
    });
  });

  it('transaction function example', done => {
    const driver = driverGlobal;
    const personName = 'Alice';

    // tag::transaction-function[]
    const session = driver.session();
    const writeTxPromise = session.writeTransaction(tx => tx.run('CREATE (a:Person {name: $name})', {'name': personName}));

    writeTxPromise.then(result => {
      session.close();

      if (result) {
        console.log('Person created');
      }
    });
    // end::transaction-function[]

    testResultPromise.then(loggedMsg => {
      expect(loggedMsg).toBe('Person created');
      done();
    });
  });

  it('pass bookmarks example', done => {
    const driver = driverGlobal;

    // tag::pass-bookmarks[]
    // Create a company node
    function addCompany(tx, name) {
      return tx.run('CREATE (a:Company {name: $name})', {'name': name});
    }

    // Create a person node
    function addPerson(tx, name) {
      return tx.run('CREATE (a:Person {name: $name})', {'name': name});
    }

    // Create an employment relationship to a pre-existing company node.
    // This relies on the person first having been created.
    function addEmployee(tx, personName, companyName) {
      return tx.run('MATCH (person:Person {name: $personName}) ' +
        'MATCH (company:Company {name: $companyName}) ' +
        'CREATE (person)-[:WORKS_FOR]->(company)', {'personName': personName, 'companyName': companyName});
    }

    // Create a friendship between two people.
    function makeFriends(tx, name1, name2) {
      return tx.run('MATCH (a:Person {name: $name1}) ' +
        'MATCH (b:Person {name: $name2}) ' +
        'MERGE (a)-[:KNOWS]->(b)', {'name1': name1, 'name2': name2});
    }

    // To collect friend relationships
    const friends = [];

    // Match and display all friendships.
    function findFriendships(tx) {
      const result = tx.run('MATCH (a)-[:KNOWS]->(b) RETURN a.name, b.name');

      result.subscribe({
        onNext: record => {
          const name1 = record.get(0);
          const name2 = record.get(1);

          friends.push({'name1': name1, 'name2': name2});
        }
      });
    }

    // To collect the session bookmarks
    const savedBookmarks = [];

    // Create the first person and employment relationship.
    const session1 = driver.session(neo4j.WRITE);
    const first = session1.writeTransaction(tx => addCompany(tx, 'Wayne Enterprises')).then(
      () => session1.writeTransaction(tx => addPerson(tx, 'Alice'))).then(
      () => session1.writeTransaction(tx => addEmployee(tx, 'Alice', 'Wayne Enterprises'))).then(
      () => {
        savedBookmarks.push(session1.lastBookmark());

        return session1.close();
      });

    // Create the second person and employment relationship.
    const session2 = driver.session(neo4j.WRITE);
    const second = session2.writeTransaction(tx => addCompany(tx, 'LexCorp')).then(
      () => session2.writeTransaction(tx => addPerson(tx, 'Bob'))).then(
      () => session2.writeTransaction(tx => addEmployee(tx, 'Bob', 'LexCorp'))).then(
      () => {
        savedBookmarks.push(session2.lastBookmark());

        return session2.close();
      });

    // Create a friendship between the two people created above.
    const last = Promise.all([first, second]).then(ignore => {
      const session3 = driver.session(neo4j.WRITE, savedBookmarks);

      return session3.writeTransaction(tx => makeFriends(tx, 'Alice', 'Bob')).then(
        () => session3.readTransaction(findFriendships).then(
          () => session3.close()
        )
      );
    });
    // end::pass-bookmarks[]

    last.then(() => {
      expect(friends.length).toBe(1);
      expect(friends[0].name1).toBe('Alice');
      expect(friends[0].name2).toBe('Bob');

      done();
    });
  });

});

function removeLineBreaks(string) {
  return string.replace(/(\r\n|\n|\r)/gm, ' ');
}
