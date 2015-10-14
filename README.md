# Neo4j Bolt Driver for Javascript

An alpha-level database driver for a new Neo4j remoting protocol.

Note: This is in active development, the API is not stable. Please try it out and give us feedback, but expect things to break in the medium term!

## Add module to Node.js application

```javascript
var neo4j = require('build/node/neo4j');
```

## Include in web browser
A global object `neo4j` will be available.

```html
<script src="build/browser/neo4j-web.min.js"></script>
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
var driver = neo4j.driver("neo4j://localhost");
var session = driver.session();

// Run a Cypher statement within an implicit transaction
// The streaming way:
session.run(statement.join(' '), params).subscribe({
    onNext: function(record) {
        // On receipt of RECORD
        for(var i in record) {
            console.log(i);
            console.log(record[i]);
        }
    }, onCompleted: function(metadata) {
        console.log(metadata);
    }, onError: function(error) {
        console.log(error);
    }
});

// or
// the collect way, with Javascript promises:
session.run(statement.join(' '), params)
    .then(function(records){
        records.forEach(function(record) {
            for(var i in record) {
                console.log(i);
                console.log(record[i]);
            }
        })
    })
    .catch(function(error) {
        console.log(error);
    });
```

## Building

    npm install 
    gulp

This produces browser-compatible standalone files under `build/browser` and a nodejs module version under `build/node`.  
See files under `examples/` on how to use.

## Testing

    ./runTests.sh

This runs the test suite against a fresh download of Neo4j.  
Or `gulp test` if you already have a running version of a compatible Neo4j server.
