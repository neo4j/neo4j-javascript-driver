# Neo4j Driver for Javascript

An alpha-level database driver for a new Neo4j remoting protocol.

Note: This is in active development, the API is not stable. Please try it out and give us feedback, but expect things to break in the medium term!

## Include module in Node.js application

```javascript
var neo4j = require('neo4j').v1;
```

## Include in web browser
A global object `neo4j` will be available.

```html
<script src="lib/browser/neo4j-web.min.js"></script>
```

## Usage examples (for both Node.js and browser environments)

```javascript
var statement = ['MERGE (alice:Person {name:{name_a},age:{age_a}})',
    'MERGE (bob:Person {name:{name_b},age:{age_b}})',
    'CREATE UNIQUE (alice)-[alice_knows_bob:KNOWS]->(bob)',
    'RETURN alice, bob, alice_knows_bob'
];

var params = {
    name_a: 'Alice',
    age_a: 33,
    name_b: 'Bob',
    age_b: 44
};


// Create a Session object to contain all Cypher activity.
var driver = neo4j.driver("bolt://localhost");
var session = driver.session();

// Run a Cypher statement within an implicit transaction
// The streaming way:
session.run(statement.join(' '), params).subscribe({
    onNext: function(record) {
        // On receipt of RECORD
        for(var i in record) {
            console.log(i, ': ', record[i]);
        }
    }, onCompleted: function() {
        session.close();
    }, onError: function(error) {
        console.log(error);
    }
});

// or
// the Promise way, where the complete response is collected:
session.run(statement.join(' '), params)
    .then(function(records){
        records.forEach(function(record) {
            for(var i in record) {
                console.log(i, ': ', record[i]);
            }
        });
        session.close();
    })
    .catch(function(error) {
        console.log(error);
    });
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

### Testing on windows
Running tests on windows requires PhantomJS installed and its bin folder added in windows system variable `Path`.
To run the same test suite, run `.\runTest.ps1` instead in powershell with admin right.
The admin right is required to start/stop Neo4j properly as a system service.
While there is no need to grab admin right if you are running tests against an existing Neo4j server using `npm test`.

## A note on numbers and the Integer type
For this driver to fully map to the Neo4j type system handling of 64-bits Integers is needed.
Javascript can saftely represent numbers between `-(2`<sup>`53`</sup>` - 1)` and `(2`<sup>`53`</sup>` - 1)`.
Therefore, an Integer type is introduced.

### Write integers
Number written directly e.g. `session.run("CREATE (n:Node {age: {age}})", {age: 22})` will be of type `Float` in Neo4j.
To write the `age` as an integer the `neo4j.int` method should be used.
E.g. `session.run("CREATE (n:Node {age: {age}})", {age: neo4j.int(22)})`.

### Read integers
To get the value of a from Neo4j received integer, the safeast way would be to use the `.toString()` method on
an Integer object.
E.g. `console.log(result.age.toString())`.
To check if a variable is of the Integer type, the method `neo4j.isInt(variable)` can be used.
