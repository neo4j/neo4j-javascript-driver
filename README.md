# Neo4j Bolt Driver for JavaScript

The JavaScript driver for Bolt uses the websocket interface and is currently available for use within a browser context only.
To use the driver, simply include the `neo4j.js` file within a page.

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

## Building & testing

    npm install
    npm test

This runs the test suite and produces browser-compatible standalone files under `build/`.

## TODO

The JavaScript driver is still missing at least the following:

- Integration with *node.js*
- `GraphDatabase` and `Driver` classes from the Session API used by other drivers
- Ability to specify the remote database URL (currently hard-coded to `bolt:localhost`)
- A `Transaction` class

