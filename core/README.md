# Core module of the Neo4j Driver for JavaScript

This is a internal package shared by the `neo4j-driver` and the `neo4j-driver-lite` drivers. This package is responsible for high level pieces of the driver such as `Session`, `Result`, `Record`, some data types and the interface for `Connection` and `ConnectionProvider`.

## Building

```
npm install
npm run build
```

This produces a Node.js module version under `lib/`.

## Testing

The tests could be executed by running `npm test`. For development, you can have the build tool rerun the tests each time you change the source code:

```
npm run test::watch
```
