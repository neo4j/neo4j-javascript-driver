# Neo4j Bolt Driver for JavaScript

The JavaScript driver for Bolt uses the websocket interface and is currently available for use within a browser context only.


## Example

```javascript
var session = new Session();

var statement = "MERGE (a:Person {name:'Alice'}) " +
                "MERGE (a)-[:KNOWS]->(b:Person {name:'Bob'}) " +
                "RETURN id(a), id(b)",
    parameters = {};

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

