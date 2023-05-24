# Neo4j Driver for Deno (Experimental)

This folder contains a script which can auto-generate a version of 
`neo4j-driver-lite` that is fully compatible with Deno, including complete type
information.

The resulting driver does not use any dependencies outside of the Deno standard
library.

## Development instructions

To generate the driver, open a shell in this folder and run this command,
specifying what version number you want the driver to identify as:

```
deno run --allow-read --allow-write --allow-net ./generate.ts --version=4.4.0
```

The script will:

1. Copy `neo4j-driver-lite` and the Neo4j packages it uses into a subfolder here
   called `lib`.
1. Rewrite all imports to Deno-compatible versions
1. Replace the "node channel" with the "deno channel"
1. Test that the resulting driver can be imported by Deno and passes type checks

It is not necessary to do any other setup first; in particular, you don't need
to install any of the Node packages or run any of the driver monorepo's other
scripts. However, you do need to have Deno installed.

## Usage instructions

Once the driver is generated in the `lib` directory, you can import it and use
it as you would use `neo4j-driver-lite` (refer to its documentation).

Here is an example:

```typescript
import neo4j from "./lib/mod.ts";
const URI = "bolt://localhost:7687";
const driver = neo4j.driver(URI, neo4j.auth.basic("neo4j", "driverdemo"));
const session = driver.session();

const results = await session.run("MATCH (n) RETURN n LIMIT 25");
console.log(results.records);

await session.close();
await driver.close();
```

You can use `deno run --allow-net ...` or `deno repl` to run this example. If
you don't have a running Neo4j instance, you can use
`docker run --rm -p 7687:7687 -e NEO4J_AUTH=neo4j/driverdemo neo4j:4.4` to
quickly spin one up.

## TLS

For using system certificates, the `DENO_TLS_CA_STORE` should be set to `"system"`.
`TRUST_ALL_CERTIFICATES` should be handle by `--unsafely-ignore-certificate-errors` and not by driver configuration. See, https://deno.com/blog/v1.13#disable-tls-verification;

