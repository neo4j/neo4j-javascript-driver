# Neo4j Driver for JavaScript
**This is a preview branch for the new Vector type in the JavaScript driver.**

The 6.0 release of the JavaScript driver will introduce the ability to read and write Vectors to the database.
These are single type arrays with inner types of int 8/16/32/64 and float 32/64. 
To facilitate ease of use and good integration with AI packages in JavaScript, Vectors will be represented by JavaScript TypedArrays.

This forces 2 changes to the driver API, which we would like feedback on before they are set in stone:
1. **Minor** You can no longer pass a TypedArray, such as a Float32Array, to the driver and get it translated to a list of numbers by the driver. To send a TypedArray as a regular list, you will need to use Array.from()
2. **Major** Raw bytes can no longer be sent using an Int8Array, which was the correct way to send them before. Bytes will now be sent and recieved as ArrayBuffers. These are the object that is wrapper by a Int8Array, so it is not a complex code change, but existing code that is used to read or write raw bytes **WILL** break.

A number of pieces of example code can be found in the Vector types examples test file [here](./packages/neo4j-driver/test/vector-examples.test.js)

The Vector type is not yet supported on the Bolt Protocol, so in this preview they are actually sent and stored as Lists of Float64. This means that any vector written with this preview will not actually be stored as a vector, and when read from the database it will again be a list of numbers. The vector test files have mock lines to convert the returned lists into the vectors they will be in the final version.

## Example code

### Read and Write Vectors
```Javascript
    const driver = neo4j.driver(uri, sharedNeo4j.authToken)
    await driver.executeQuery('CREATE (p:Product) SET p.embeddings = $embeddings', {
      embeddings: Float32Array.from([0, 1, 2, 3]), //Typed arrays can be created from a regular list of Numbers
    })
    const res = await driver.executeQuery('MATCH (p:Product) RETURN p.embeddings as embeddings')
    
    let vector = res.records[0].get('embeddings')
    
    // THIS LINE IS HERE TO EMULATE THE FINISHED PROPOSED API
    vector = Float32Array.from(vector)

    console.log(vector[3]) //3

    await driver.close()
```

### Read and Write Bytes
```Javascript
    const driver = neo4j.driver(uri, sharedNeo4j.authToken)
    const byteWriter = Int8Array.from([0, 1, 2, 3])
    await driver.executeQuery('CREATE (p:Product) SET p.bytes = $bytes', {
      //bytes: byteWriter #THis was the proper way to send bytes before, but this will send an Int8 vector in the proposed API
      bytes: byteWriter.buffer //This is the new way to send bytes
    })
    const res = await driver.executeQuery('MATCH (p:Product) RETURN p.bytes as bytes')
    
    let bytes = res.records[0].get('bytes') //In the old API, this would now be an Int8Array, but is now an Arraybuffer
    bytes = Int8Array.from(bytes) //This converts the object into an Int8Array, able to be used as before.

    console.log(bytes[3]) //3

    await driver.close()
```
