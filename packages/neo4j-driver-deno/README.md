# Neo4j Driver for Deno (Experimental)

> :warning: **This is a experimental library.**

This is the Deno version of the official Neo4j driver for JavaScript.

This is version is based on the lite version of the official Neo4j driver for JavaScript.

This version of the driver has the same capabilities as the Neo4j Driver except for the support of reactive sessions.
This means it doesn't have the `RxJS` dependency and the `Driver#rxSession` api.

Starting with 5.0, the Neo4j Drivers will be moving to a monthly release cadence. A minor version will be released on the last Friday of each month so as to maintain versioning consistency with the core product (Neo4j DBMS) which has also moved to a monthly cadence.

As a policy, patch versions will not be released except on rare occasions. Bug fixes and updates will go into the latest minor version and users should upgrade to that. Driver upgrades within a major version will never contain breaking API changes.

See also: https://neo4j.com/developer/kb/neo4j-supported-versions/

Resources to get you started:

- [API Documentation](https://neo4j.com/docs/api/javascript-driver/current/)
- [Neo4j Manual](https://neo4j.com/docs/)
- [Neo4j Refcard](https://neo4j.com/docs/cypher-refcard/current/)

## What's New in 5.x

- [Changelog](https://github.com/neo4j/neo4j-javascript-driver/wiki/5.0-changelog)

## Including the Driver

```typescript
import neo4j from "./lib/mod.ts"
```
Scripts which makes usage of driver should use define the following flags to `deno run` command:

* `--allow-net`
* `--allow-sys`

Deno versions bellow `1.27.1` should be run with the flag `--allow-env` instead of `--allow-sys`.

### TLS

For using system certificates, the `DENO_TLS_CA_STORE` should be set to `"system"`.
`TRUST_ALL_CERTIFICATES` should be handle by `--unsafely-ignore-certificate-errors` and not by driver configuration. See, https://deno.com/blog/v1.13#disable-tls-verification;

## Usage examples

### Constructing a Driver

```javascript
// Create a driver instance, for the user `neo4j` with password `password`.
// It should be enough to have a single driver per database per application.
const driver = neo4j.driver(
  'neo4j://localhost',
  neo4j.auth.basic('neo4j', 'password')
)

// Close the driver when application exits.
// This closes all used network connections.
await driver.close()
```

### Acquiring a Session

#### Regular Session

```typescript
// Create a session to run Cypher statements in.
// Note: Always make sure to close sessions when you are done using them!
const session = driver.session()
```

##### with a Default Access Mode of `READ`

```typescript
const session = driver.session({ defaultAccessMode: neo4j.session.READ })
```

##### with Bookmarks

```typescript
const session = driver.session({
  bookmarks: [bookmark1FromPreviousSession, bookmark2FromPreviousSession]
})
```

##### against a Database

```typescript
const session = driver.session({
  database: 'foo',
  defaultAccessMode: neo4j.session.WRITE
})
```

### Executing Queries

#### Consuming Records with Streaming API

```typescript
// Run a Cypher statement, reading the result in a streaming manner as records arrive:
session
  .run('MERGE (alice:Person {name : $nameParam}) RETURN alice.name AS name', {
    nameParam: 'Alice'
  })
  .subscribe({
    onKeys: keys => {
      console.log(keys)
    },
    onNext: record => {
      console.log(record.get('name'))
    },
    onCompleted: () => {
      session.close() // returns a Promise
    },
    onError: error => {
      console.log(error)
    }
  })
```

Subscriber API allows following combinations of `onKeys`, `onNext`, `onCompleted` and `onError` callback invocations:

- zero or one `onKeys`,
- zero or more `onNext` followed by `onCompleted` when operation was successful. `onError` will not be invoked in this case
- zero or more `onNext` followed by `onError` when operation failed. Callback `onError` might be invoked after couple `onNext` invocations because records are streamed lazily by the database. `onCompleted` will not be invoked in this case.

#### Consuming Records with Promise API

```typescript
// the Promise way, where the complete result is collected before we act on it:
session
  .run('MERGE (james:Person {name : $nameParam}) RETURN james.name AS name', {
    nameParam: 'James'
  })
  .then(result => {
    result.records.forEach(record => {
      console.log(record.get('name'))
    })
  })
  .catch(error => {
    console.log(error)
  })
  .then(() => session.close())
```

### Transaction functions

```typescript
// Transaction functions provide a convenient API with minimal boilerplate and
// retries on network fluctuations and transient errors. Maximum retry time is
// configured on the driver level and is 30 seconds by default:
// Applies both to standard and reactive sessions.
neo4j.driver('neo4j://localhost', neo4j.auth.basic('neo4j', 'password'), {
  maxTransactionRetryTime: 30000
})
```

#### Reading with Async Session

```typescript
// It is possible to execute read transactions that will benefit from automatic
// retries on both single instance ('bolt' URI scheme) and Causal Cluster
// ('neo4j' URI scheme) and will get automatic load balancing in cluster deployments
const readTxResultPromise = session.readTransaction(txc => {
  // used transaction will be committed automatically, no need for explicit commit/rollback

  const result = txc.run('MATCH (person:Person) RETURN person.name AS name')
  // at this point it is possible to either return the result or process it and return the
  // result of processing it is also possible to run more statements in the same transaction
  return result
})

// returned Promise can be later consumed like this:
readTxResultPromise
  .then(result => {
    console.log(result.records)
  })
  .catch(error => {
    console.log(error)
  })
  .then(() => session.close())
```

#### Writing with Async Session

```typescript
// It is possible to execute write transactions that will benefit from automatic retries
// on both single instance ('bolt' URI scheme) and Causal Cluster ('neo4j' URI scheme)
const writeTxResultPromise = session.writeTransaction(async txc => {
  // used transaction will be committed automatically, no need for explicit commit/rollback

  const result = await txc.run(
    "MERGE (alice:Person {name : 'Alice'}) RETURN alice.name AS name"
  )
  // at this point it is possible to either return the result or process it and return the
  // result of processing it is also possible to run more statements in the same transaction
  return result.records.map(record => record.get('name'))
})

// returned Promise can be later consumed like this:
writeTxResultPromise
  .then(namesArray => {
    console.log(namesArray)
  })
  .catch(error => {
    console.log(error)
  })
  .then(() => session.close())
```

### Explicit Transactions

#### With Async Session

```typescript
// run statement in a transaction
const txc = session.beginTransaction()
try {
  const result1 = await txc.run(
    'MERGE (bob:Person {name: $nameParam}) RETURN bob.name AS name',
    {
      nameParam: 'Bob'
    }
  )
  result1.records.forEach(r => console.log(r.get('name')))
  console.log('First query completed')

  const result2 = await txc.run(
    'MERGE (adam:Person {name: $nameParam}) RETURN adam.name AS name',
    {
      nameParam: 'Adam'
    }
  )
  result2.records.forEach(r => console.log(r.get('name')))
  console.log('Second query completed')

  await txc.commit()
  console.log('committed')
} catch (error) {
  console.log(error)
  await txc.rollback()
  console.log('rolled back')
} finally {
  await session.close()
}
```

### Numbers and the Integer type

The Neo4j type system uses 64-bit signed integer values. The range of values is between `-(2`<sup>`64`</sup>`- 1)` and `(2`<sup>`63`</sup>`- 1)`.

However, JavaScript can only safely represent integers between `Number.MIN_SAFE_INTEGER` `-(2`<sup>`53`</sup>`- 1)` and `Number.MAX_SAFE_INTEGER` `(2`<sup>`53`</sup>`- 1)`.

In order to support the full Neo4j type system, the driver will not automatically convert to javascript integers.
Any time the driver receives an integer value from Neo4j, it will be represented with an internal integer type by the driver.

_**Any javascript number value passed as a parameter will be recognized as `Float` type.**_

#### Writing integers

Numbers written directly e.g. `session.run("CREATE (n:Node {age: $age})", {age: 22})` will be of type `Float` in Neo4j.

To write the `age` as an integer the `neo4j.int` method should be used:

```typescript
session.run('CREATE (n {age: $myIntParam})', { myIntParam: neo4j.int(22) })
```

To write an integer value that are not within the range of `Number.MIN_SAFE_INTEGER` `-(2`<sup>`53`</sup>`- 1)` and `Number.MAX_SAFE_INTEGER` `(2`<sup>`53`</sup>`- 1)`, use a string argument to `neo4j.int`:

```typescript
session.run('CREATE (n {age: $myIntParam})', {
  myIntParam: neo4j.int('9223372036854775807')
})
```

#### Reading integers

In Neo4j, the type Integer can be larger what can be represented safely as an integer with JavaScript Number.

It is only safe to convert to a JavaScript Number if you know that the number will be in the range `Number.MIN_SAFE_INTEGER` `-(2`<sup>`53`</sup>`- 1)` and `Number.MAX_SAFE_INTEGER` `(2`<sup>`53`</sup>`- 1)`.

In order to facilitate working with integers the driver include `neo4j.isInt`, `neo4j.integer.inSafeRange`, `neo4j.integer.toNumber`, and `neo4j.integer.toString`.

```typescript
var smallInteger = neo4j.int(123)
if (neo4j.integer.inSafeRange(smallInteger)) {
  var aNumber = smallInteger.toNumber()
}
```

If you will be handling integers that is not within the JavaScript safe range of integers, you should convert the value to a string:

```typescript
var largeInteger = neo4j.int('9223372036854775807')
if (!neo4j.integer.inSafeRange(largeInteger)) {
  var integerAsString = largeInteger.toString()
}
```

#### Enabling native numbers

Starting from 1.6 version of the driver it is possible to configure it to only return native numbers instead of custom `Integer` objects.
The configuration option affects all integers returned by the driver. **Enabling this option can result in a loss of precision and incorrect numeric
values being returned if the database contains integer numbers outside of the range** `[Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`.
To enable potentially lossy integer values use the driver's configuration object:

```typescript
var driver = neo4j.driver(
  'neo4j://localhost',
  neo4j.auth.basic('neo4j', 'password'),
  { disableLosslessIntegers: true }
)
```
