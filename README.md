# Neo4j Bolt Driver for JavaScript

The JavaScript driver for Bolt uses the websocket interface.

## Example

```javascript
// Create a Session object to contain all Cypher activity.
var session = new Session();

var statement = "MERGE (a:Person {name:'Alice'}) " +
                "MERGE (a)-[:KNOWS]->(b:Person {name:'Bob'}) " +
                "RETURN id(a), id(b)",
    parameters = {};

// Run a Cypher statement within an implicit transaction
session.run(statement, parameters,

    // Called on receipt of each RECORD
    function(record) {
        console.log("Values: " + record.join());
    },

    // Called on receipt of header summary message
    function(success, metadata) {
        if (success) {
            console.log("Fields: " + metadata["fields"].join());
        }
        else {
            console.log("FAILURE");
        }
        
    }

);
```

## Building

    npm install 
    gulp

This produces browser-compatible standalone files under `build/`.

## Testing

    ./runTests.sh

This runs the test suite against a fresh download of Neo4j.

## TODO

The JavaScript driver is still missing at least the following:

- Integration with *node.js*
- `GraphDatabase` and `Driver` classes from the Session API used by other drivers
- Ability to specify the remote database URL (currently hard-coded to `bolt:localhost`)
- A `Transaction` class

