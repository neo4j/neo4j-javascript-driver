# Neo4j Driver for JavaScript


A database driver for Neo4j 3.0.0+.

Resources to get you started:

* [Detailed docs](http://neo4j.com/docs/api/javascript-driver/current/).
* [Sample small project using the driver](https://github.com/neo4j-examples/movies-javascript-bolt)
* [Sample application using the driver](https://github.com/neo4j-examples/neo4j-movies-template)
* [Neo4j Manual](https://neo4j.com/docs/)
* [Neo4j Refcard](https://neo4j.com/docs/cypher-refcard/current/)

## Include module in Node.js application

Stable channel:
```shell
npm install neo4j-driver
```

Pre-release channel:
```shell
npm install neo4j-driver@next
```

Please note that `@next` only points to pre-releases that are not suitable for production use.
To get the latest stable release omit `@next` part altogether or use `@latest` instead.

```javascript
var neo4j = require('neo4j-driver').v1;
```
Driver instance should be closed when Node.js application exits:

```javascript
driver.close();
```

otherwise application shutdown might hang or it might exit with a non-zero exit code.

## Include in web browser

We build a special browser version of the driver, which supports connecting to Neo4j over WebSockets.
It can be included in an HTML page using one of the following tags:

```html
<!-- Direct reference -->
<script src="lib/browser/neo4j-web.min.js"></script>

<!-- unpkg CDN non-minified -->
<script src="https://unpkg.com/neo4j-driver"></script>
<!-- unpkg CDN minified for production use, version X.Y.Z -->
<script src="https://unpkg.com/neo4j-driver@X.Y.Z/lib/browser/neo4j-web.min.js"></script>

<!-- jsDelivr CDN non-minified -->
<script src="https://cdn.jsdelivr.net/npm/neo4j-driver"></script>
<!-- jsDelivr CDN minified for production use, version X.Y.Z -->
<script src="https://cdn.jsdelivr.net/npm/neo4j-driver@X.Y.Z/lib/browser/neo4j-web.min.js"></script>

```

This will make a global `neo4j` object available, where you can access the `v1` API at `neo4j.v1`:

```javascript
var driver = neo4j.v1.driver("bolt://localhost", neo4j.v1.auth.basic("neo4j", "neo4j"));
```

It is not required to explicitly close the driver on a web page. Web browser should gracefully close all open 
WebSockets when the page is unloaded. However, driver instance should be explicitly closed when it's lifetime
is not the same as the lifetime of the web page:
 
```javascript
driver.close();
```

## Usage examples

Driver lifecycle:
```javascript
// Create a driver instance, for the user neo4j with password neo4j.
// It should be enough to have a single driver per database per application.
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));

// Close the driver when application exits.
// This closes all used network connections.
driver.close();
```

Session API:
```javascript
// Create a session to run Cypher statements in.
// Note: Always make sure to close sessions when you are done using them!
var session = driver.session();

// Run a Cypher statement, reading the result in a streaming manner as records arrive:
session
  .run('MERGE (alice:Person {name : {nameParam} }) RETURN alice.name AS name', {nameParam: 'Alice'})
  .subscribe({
    onNext: function (record) {
      console.log(record.get('name'));
    },
    onCompleted: function () {
      session.close();
    },
    onError: function (error) {
      console.log(error);
    }
  });

// or
// the Promise way, where the complete result is collected before we act on it:
session
  .run('MERGE (james:Person {name : {nameParam} }) RETURN james.name AS name', {nameParam: 'James'})
  .then(function (result) {
    result.records.forEach(function (record) {
      console.log(record.get('name'));
    });
    session.close();
  })
  .catch(function (error) {
    console.log(error);
  });
```

Transaction functions API:
```javascript
// Transaction functions provide a convenient API with minimal boilerplate and
// retries on network fluctuations and transient errors. Maximum retry time is
// configured on the driver level and is 30 seconds by default:
neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {maxTransactionRetryTime: 30000});

// It is possible to execute read transactions that will benefit from automatic
// retries on both single instance ('bolt' URI scheme) and Causal Cluster
// ('bolt+routing' URI scheme) and will get automatic load balancing in cluster deployments
var readTxResultPromise = session.readTransaction(function (transaction) {
  // used transaction will be committed automatically, no need for explicit commit/rollback

  var result = transaction.run('MATCH (person:Person) RETURN person.name AS name');
  // at this point it is possible to either return the result or process it and return the
  // result of processing it is also possible to run more statements in the same transaction
  return result;
});

// returned Promise can be later consumed like this:
readTxResultPromise.then(function (result) {
  session.close();
  console.log(result.records);
}).catch(function (error) {
  console.log(error);
});

// It is possible to execute write transactions that will benefit from automatic retries
// on both single instance ('bolt' URI scheme) and Causal Cluster ('bolt+routing' URI scheme)
var writeTxResultPromise = session.writeTransaction(function (transaction) {
  // used transaction will be committed automatically, no need for explicit commit/rollback

  var result = transaction.run('MERGE (alice:Person {name : \'Alice\' }) RETURN alice.name AS name');
  // at this point it is possible to either return the result or process it and return the
  // result of processing it is also possible to run more statements in the same transaction
  return result.records.map(function (record) {
    return record.get('name');
  });
});

// returned Promise can be later consumed like this:
writeTxResultPromise.then(function (namesArray) {
  session.close();
  console.log(namesArray);
}).catch(function (error) {
  console.log(error);
});
```

Explicit transactions API:
```javascript
// run statement in a transaction
var tx = session.beginTransaction();

tx.run("MERGE (bob:Person {name : {nameParam} }) RETURN bob.name AS name", {nameParam: 'Bob'})
  .subscribe({
    onNext: function (record) {
      console.log(record.get('name'));
    },
    onCompleted: function () {
      console.log('First query completed');
    },
    onError: function (error) {
      console.log(error);
    }
  });
  
tx.run("MERGE (adam:Person {name : {nameParam} }) RETURN adam.name AS name", {nameParam: 'Adam'})
  .subscribe({
    onNext: function (record) {
      console.log(record.get('name'));
    },
    onCompleted: function () {
      console.log('Second query completed');
    },
    onError: function (error) {
      console.log(error);
    }
  });

//decide if the transaction should be committed or rolled back
var success = false;

if (success) {
  tx.commit()
    .subscribe({
      onCompleted: function () {
        // this transaction is now committed and session can be closed
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
} else {
  //transaction is rolled black and nothing is created in the database
  console.log('rolled back');
  tx.rollback();
}
```

Subscriber API allows following combinations of `onNext`, `onCompleted` and `onError` callback invocations:
 * zero or more `onNext` followed by `onCompleted` when operation was successful. `onError` will not be invoked 
 in this case
 * zero or more `onNext` followed by `onError` when operation failed. Callback `onError` might be invoked after 
 couple `onNext` invocations because records are streamed lazily by the database. `onCompleted` will not be invoked 
 in this case

## Parallelization
In a single session, multiple queries will be executed serially. In order to parallelize queries, multiple sessions are required.

## Building

    npm install
    npm run build

This produces browser-compatible standalone files under `lib/browser` and a Node.js module version under `lib/`.
See files under `examples/` on how to use.

## Testing

Tests **require** latest [Boltkit](https://github.com/neo4j-contrib/boltkit) to be installed in the system. It is needed to start, stop and configure local test database. Boltkit can be installed with the following command:

    pip install --upgrade boltkit

To run tests against "default" Neo4j version:

    ./runTests.sh
    
To run tests against specified Neo4j version:
    
    ./runTests.sh '-e 3.1.3'

Simple `npm test` can also be used if you already have a running version of a compatible Neo4j server.

For development, you can have the build tool rerun the tests each time you change
the source code:

    gulp watch-n-test

### Testing on windows
Running tests on windows requires PhantomJS installed and its bin folder added in windows system variable `Path`.
To run the same test suite, run `.\runTest.ps1` instead in powershell with admin right.
The admin right is required to start/stop Neo4j properly as a system service.
While there is no need to grab admin right if you are running tests against an existing Neo4j server using `npm test`.

## A note on numbers and the Integer type
The Neo4j type system includes 64-bit integer values.
However, JavaScript can only safely represent integers between `-(2`<sup>`53`</sup>` - 1)` and `(2`<sup>`53`</sup>` - 1)`.
In order to support the full Neo4j type system, the driver will not automatically convert to javascript integers.
Any time the driver receives an integer value from Neo4j, it will be represented with an internal integer type by the driver.

### Write integers
Number written directly e.g. `session.run("CREATE (n:Node {age: {age}})", {age: 22})` will be of type `Float` in Neo4j.
To write the `age` as an integer the `neo4j.int` method should be used:

```javascript
var neo4j = require('neo4j-driver').v1;

session.run("CREATE (n {age: {myIntParam}})", {myIntParam: neo4j.int(22)});
```

To write integers larger than can be represented as JavaScript numbers, use a string argument to `neo4j.int`:

```javascript
session.run("CREATE (n {age: {myIntParam}})", {myIntParam: neo4j.int("9223372036854775807")});
```

### Read integers
Since Integers can be larger than can be represented as JavaScript numbers, it is only safe to convert to JavaScript numbers if you know that they will not exceed `(2`<sup>`53`</sup>` - 1)` in size.
In order to facilitate working with integers the driver include `neo4j.isInt`, `neo4j.integer.inSafeRange`, `neo4j.integer.toNumber`, and `neo4j.integer.toString`.

```javascript
var aSmallInteger = neo4j.int(123);
if (neo4j.integer.inSafeRange(aSmallInteger)) {
    var aNumber = aSmallInteger.toNumber();
}
```

If you will be handling integers larger than that, you should convert them to strings:

```javascript
var aLargerInteger = neo4j.int("9223372036854775807");
if (!neo4j.integer.inSafeRange(aLargerInteger)) {
    var integerAsString = aLargerInteger.toString();
}
```

### Enable native numbers

Starting from 1.6 version of the driver it is possible to configure it to only return native numbers instead of custom `Integer` objects.
The configuration option affects all integers returned by the driver. **Enabling this option can result in a loss of precision and incorrect numeric
values being returned if the database contains integer numbers outside of the range** `[Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`.
To enable potentially lossy integer values use the driver's configuration object:

```javascript
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {disableLosslessIntegers: true});
```

