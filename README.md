# Neo4j Driver for Javascript


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
// or
bower install neo4j-driver
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

```html
<script src="lib/browser/neo4j-web.min.js"></script>
```

This will make a global `neo4j` object available, where you can access the `v1` API at `neo4j.v1`:

```javascript
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
```

It is not required to explicitly close the driver on a web page. Web browser should gracefully close all open 
WebSockets when the page is unloaded. However, driver instance should be explicitly closed when it's lifetime
is not the same as the lifetime of the web page:
 
```javascript
driver.close();
```

## Usage examples

```javascript

// Create a driver instance, for the user neo4j with password neo4j.
// It should be enough to have a single driver per database per application.
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));

// Register a callback to know if driver creation was successful:
driver.onCompleted = function() {
  // proceed with using the driver, it was successfully instantiated
};

// Register a callback to know if driver creation failed.
// This could happen due to wrong credentials or database unavailability:
driver.onError = function(error) {
  console.log('Driver instantiation failed', error);
};

// Create a session to run Cypher statements in.
// Note: Always make sure to close sessions when you are done using them!
var session = driver.session();

// Run a Cypher statement, reading the result in a streaming manner as records arrive:
session
  .run("MERGE (alice:Person {name : {nameParam} }) RETURN alice.name", { nameParam:'Alice' })
  .subscribe({
    onNext: function(record) {
     console.log(record._fields);
    },
    onCompleted: function() {
      // Completed!
      session.close();
    },
    onError: function(error) {
      console.log(error);
    }
  });

// or
// the Promise way, where the complete result is collected before we act on it:
session
  .run("MERGE (james:Person {name : {nameParam} }) RETURN james.name", { nameParam:'James' })
  .then(function(result){
    result.records.forEach(function(record) {
      console.log(record._fields);
    });
    // Completed!
    session.close();
  })
  .catch(function(error) {
    console.log(error);
  });

//run statement in a transaction
var tx = session.beginTransaction();
tx.run("MERGE (bob:Person {name : {nameParam} }) RETURN bob.name", { nameParam:'Bob' })
  .subscribe({
    onNext: function(record) {
      console.log(record._fields);
      },
    onCompleted: function() {
      // Completed!
      session.close();
    },
    onError: function(error) {
      console.log(error);
    }
  });
  
//decide if the transaction should be committed or rolled back
var success = false;

if (success) {
  tx.commit()
    .subscribe({
      onCompleted: function() {
        // Completed!
      },
      onError: function(error) {
        console.log(error);
        }
      });
  } else {
  //transaction is rolled black and nothing is created in the database
  console.log('rolled back');
  tx.rollback();
}

// Close the driver when application exits
driver.close();
```

Subscriber API allows following combinations of `onNext`, `onCompleted` and `onError` callback invocations:
 * zero or more `onNext` followed by `onCompleted` when operation was successful. `onError` will not be invoked 
 in this case
 * zero or more `onNext` followed by `onError` when operation failed. Callback `onError` might be invoked after 
 couple `onNext` invocations because records are streamed lazily by the database. `onCompleted` will not be invoked 
 in this case

## Building

    npm install
    npm build

This produces browser-compatible standalone files under `lib/browser` and a Node.js module version under `lib/`.
See files under `examples/` on how to use.

## Testing

    ./runTests.sh

This runs the test suite against a fresh download of Neo4j.
Or `npm test` if you already have a running version of a compatible Neo4j server.

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
However, Javascript can only safely represent integers between `-(2`<sup>`53`</sup>` - 1)` and `(2`<sup>`53`</sup>` - 1)`.
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

If you will be handling integers larger than that, you can should convert them to strings:

```javascript
var aLargerInteger = neo4j.int("9223372036854775807");
if (!neo4j.integer.inSafeRange(aSmallInteger)) {
    var integerAsString = aLargerInteger.toString();
}
```

