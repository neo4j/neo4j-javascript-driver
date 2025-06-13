# Neo4j Driver for JavaScript
**This is a preview branch for the new Vector type in the JavaScript driver.**

The 6.0 release of the JavaScript driver will introduce the ability to read and write Vectors to the database.
These are single type arrays with inner types of int 8/16/32/64 and float 32/64. 
To facilitate ease of use and good integration with AI packages in JavaScript, Vectors will be represented by JavaScript TypedArrays, wrapped inside a new Vector type much like Integers.

A number of pieces of example code can be found in the Vector types examples test file [here](./packages/neo4j-driver/test/vector-examples.test.js)

Vector types are usuable from bolt version 6.0 and forward, which no current server currently supports, so this can not be tested against any live Neo4j Database at this time.

## Example code

### Read and Write Vectors
```Javascript
    const driver = neo4j.driver(uri, sharedNeo4j.authToken)
    await driver.executeQuery('CREATE (p:Product) SET p.embeddings = $embeddings', {
      embeddings: neo4j.vector(Float32Array.from([0, 1, 2, 3])), //Typed arrays can be created from a regular list of Numbers
    })
    const res = await driver.executeQuery('MATCH (p:Product) RETURN p.embeddings as embeddings')
    
    let vector = res.records[0].get('embeddings')

    console.log(vector.toTypedArray()) //Float32Array[0, 1, 2, 3]
    console.log(vector.type) //FLOAT32

    await driver.close()
```
