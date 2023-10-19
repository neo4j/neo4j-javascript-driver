# Neo4j Lite Driver for Deno (Preview)

> :warning: **This package stills a PREVIEW version.**

This is the Deno version of the official Neo4j driver for JavaScript.

This version of driver is based in the `neo4j-driver-lite`. 
So, this version has the same capabilities as the Neo4j Driver except for the support of reactive sessions.
This means it doesn't have the `RxJS` dependency and the `Driver#rxSession` api.

Starting with 5.0, the Neo4j Drivers will be moving to a monthly release cadence. A minor version will be released on the last Friday of each month so as to maintain versioning consistency with the core product (Neo4j DBMS) which has also moved to a monthly cadence.

As a policy, patch versions will not be released except on rare occasions. Bug fixes and updates will go into the latest minor version and users should upgrade to that. Driver upgrades within a major version will never contain breaking API changes.

See also: https://neo4j.com/developer/kb/neo4j-supported-versions/

Resources to get you started:

- [API Documentation](https://neo4j.com/docs/api/javascript-driver/current/)
- [Neo4j Manual](https://neo4j.com/docs/)
- [Neo4j Refcard](https://neo4j.com/docs/cypher-refcard/current/)
- [TLS](#tls)

## What's New in 5.x

- [Changelog](https://github.com/neo4j/neo4j-javascript-driver/wiki/5.0-changelog)

## Usage

Importing the driver:

```typescript
import neo4j from "https://deno.land/x/neo4j_driver_lite@VERSION/mod.ts";
```

Driver instance should be closed when application exits:

```javascript
await driver.close()
```
otherwise the application shutdown might hang or exit with a non-zero exit code.

Application which uses the should use `--allow-net --allow-sys...` for running.
For Deno versions bellow `1.27.1`, you should use the flag `--allow-env` instead of `--allow-sys`.

### TLS

For using system certificates, the `DENO_TLS_CA_STORE` should be set to `"system"`.
`TRUST_ALL_CERTIFICATES` should be handle by `--unsafely-ignore-certificate-errors` and not by driver configuration. See, https://deno.com/blog/v1.13#disable-tls-verification;

### Basic Example

```typescript
const URI = "bolt://localhost:7687";
const driver = neo4j.driver(URI, neo4j.auth.basic("neo4j", "driverdemo"));

const { records } = await driver.executeQuery("MATCH (n) RETURN n LIMIT 25");
console.log(records);

await driver.close();

```

### Numbers and the Integer type

The Neo4j type system uses 64-bit signed integer values. The range of values is between `-(2`<sup>`64`</sup>`- 1)` and `(2`<sup>`63`</sup>`- 1)`.

However, JavaScript can only safely represent integers between `Number.MIN_SAFE_INTEGER` `-(2`<sup>`53`</sup>`- 1)` and `Number.MAX_SAFE_INTEGER` `(2`<sup>`53`</sup>`- 1)`.

In order to support the full Neo4j type system, the driver will not automatically convert to javascript integers.
Any time the driver receives an integer value from Neo4j, it will be represented with an internal integer type by the driver.

_**Any javascript number value passed as a parameter will be recognized as `Float` type.**_

#### Writing integers

Numbers written directly e.g. `session.run("CREATE (n:Node {age: $age})", {age: 22})` will be of type `Float` in Neo4j.

To write the `age` as an integer the `neo4j.int` method should be used:

```javascript
session.run('CREATE (n {age: $myIntParam})', { myIntParam: neo4j.int(22) })
```

To write an integer value that are not within the range of `Number.MIN_SAFE_INTEGER` `-(2`<sup>`53`</sup>`- 1)` and `Number.MAX_SAFE_INTEGER` `(2`<sup>`53`</sup>`- 1)`, use a string argument to `neo4j.int`:

```javascript
session.run('CREATE (n {age: $myIntParam})', {
  myIntParam: neo4j.int('9223372036854775807')
})
```

#### Reading integers

In Neo4j, the type Integer can be larger what can be represented safely as an integer with JavaScript Number.

It is only safe to convert to a JavaScript Number if you know that the number will be in the range `Number.MIN_SAFE_INTEGER` `-(2`<sup>`53`</sup>`- 1)` and `Number.MAX_SAFE_INTEGER` `(2`<sup>`53`</sup>`- 1)`.

In order to facilitate working with integers the driver include `neo4j.isInt`, `neo4j.integer.inSafeRange`, `neo4j.integer.toNumber`, and `neo4j.integer.toString`.

```javascript
var smallInteger = neo4j.int(123)
if (neo4j.integer.inSafeRange(smallInteger)) {
  var aNumber = smallInteger.toNumber()
}
```

If you will be handling integers that is not within the JavaScript safe range of integers, you should convert the value to a string:

```javascript
var largeInteger = neo4j.int('9223372036854775807')
if (!neo4j.integer.inSafeRange(largeInteger)) {
  var integerAsString = largeInteger.toString()
}
```

#### Enabling native numbers

Starting from 1.6 version of the driver it is possible to configure it to only return native numbers instead of custom `Integer` objects.
The configuration option affects all integers returned by the driver. **Enabling this option can result in a loss of precision and incorrect numeric
values being returned if the database contains integer numbers outside of the range** `[Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`.
To enable potentially lossy integer values use the driver's configuration object:

```javascript
var driver = neo4j.driver(
  'neo4j://localhost',
  neo4j.auth.basic('neo4j', 'password'),
  { disableLosslessIntegers: true }
)
```

