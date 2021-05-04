# Bolt connection module of the Neo4j Driver for JavaScript

This is an internal package shared by the `neo4j-driver` and the `neo4j-driver-lite` drivers. This package is responsible for implementing the [Bolt Protocol](https://7687.org/) using the `Connection` and `ConnectionProvider` interfaces defined by `neo4j-driver-core` package.

## Building

It's required to first build the `neo4j-driver-core` under the `../core` (see instruction on its folder). Then,

```
npm install
npm run build
```

This produces a Node.js module version under `lib/`.

## Testing

The tests can be executed by running `npm test`. For development, you can have the build tool rerun the tests each time you change the source code:

```
npm run test::watch
```
