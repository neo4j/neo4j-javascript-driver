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

You can use `deno run --allow-net --allow-sys...` or `deno repl` to run this example. 

For Deno versions bellow `1.27.1`, you should use the flag `--allow-env` instead of `--allow-sys`.

If you don't have a running Neo4j instance, you can use
`docker run --rm -p 7687:7687 -e NEO4J_AUTH=neo4j/driverdemo neo4j:4.4` to
quickly spin one up.

## TLS

For using system certificates, the `DENO_TLS_CA_STORE` should be set to `"system"`.
`TRUST_ALL_CERTIFICATES` should be handle by `--unsafely-ignore-certificate-errors` and not by driver configuration. See, https://deno.com/blog/v1.13#disable-tls-verification;

## Tests

Tests **require** latest [Testkit 5.0](https://github.com/neo4j-drivers/testkit/tree/5.0), Python3 and Docker.

Testkit is needed to be cloned and configured to run against the Javascript Lite Driver. Use the following steps to configure Testkit.

1. Clone the Testkit repository

```
git clone https://github.com/neo4j-drivers/testkit.git
```

2. Under the Testkit folder, install the requirements.

```
pip3 install -r requirements.txt
```

3. Define some enviroment variables to configure Testkit

```
export TEST_DRIVER_NAME=javascript
export TEST_DRIVER_REPO=<path for the root folder of driver repository>
export TEST_DRIVER_DENO=1
```

To run test against against some Neo4j version:

```
python3 main.py
```

More details about how to use Teskit could be found on [its repository](https://github.com/neo4j-drivers/testkit/tree/5.0)

