# Neo4j Driver for Javascript


A database driver for Neo4j 3.0.0+.

Find detailed docs [here](http://neo4j.com/docs/api/javascript-driver/current/).

## Include module in Node.js application

```shell
npm install neo4j-driver
// or
bower install neo4j-driver
```

```javascript
var neo4j = require('neo4j-driver').v1;
```

## Include in web browser

We build a special browser version of the driver, which supports connecting to Neo4j over WebSockets.

```html
<script src="lib/browser/neo4j-web.min.js"></script>
```

This will make a global `neo4j` object available, where you can access the `v1` API at `neo4j.v1`:

```javascript
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
```

## Usage examples

```javascript

// Create a driver instance, for the user neo4j with password neo4j.
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));

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
```

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
In order to support the full Neo4j type system, the driver includes an explicit Integer types.
Any time the driver recieves an Integer value from Neo4j, it will be represented with the Integer type by the driver.

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
Since Integers can be larger than can be represented as JavaScript numbers, it is only safe to convert Integer instances to JavaScript numbers if you know that they will not exceed `(2`<sup>`53`</sup>` - 1)` in size:

```javascript
var aSmallInteger = neo4j.int(123);
var aNumber = aSmallInteger.toNumber();
```

If you will be handling integers larger than that, you can use the Integer instances directly, or convert them to strings:

```javascript
var aLargerInteger = neo4j.int("9223372036854775807");
var integerAsString = aLargerInteger.toString();
```

To help you work with Integers, the Integer class exposes a large set of arithmetic methods.
Refer to the [Integer API docs](http://neo4j.com/docs/api/javascript-driver/current/class/src/v1/integer.js~Integer.html) for details.
