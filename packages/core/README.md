# Core module of the Neo4j Driver for JavaScript

> :warning: **This package is not intended to be used by end users, it contains the abstractions used by the `neo4j-driver` to handle `Neo4j` connections.**

This is a internal package shared by the [neo4j-driver](https://www.npmjs.com/package/neo4j-driver) and the [neo4j-driver-lite](https://www.npmjs.com/package/neo4j-driver-lite) drivers. This package is responsible for high level pieces of the driver such as `Session`, `Result`, `Record`, some data types and the interface for `Connection` and `ConnectionProvider`.

## Building

The build of this package is handled by the root package of this repository.

First it is needed to install the mono-repo dependencies by running `npm ci` in the root of the repository. Then:

* Build all could be performed with 


```
npm run build
```
* Build only the Core could be performed with
Builind only Core:
```
npm run build -- --scope=neo4j-driver-core

```

This produces a Node.js module version under `lib/`.

## Testing

The tests could be executed by running `npm test` in this package folder. For development, you can have the build tool rerun the tests each time you change the source code:

```
npm run test::watch
```
