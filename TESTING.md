# Neo4j Driver Testing

## Unit Tests

Unit tests **require** to setup the development environment as described at `CONTRIBUTING.md`.

* To run unit tests for the whole project:

```bash
$ npm run test::unit
```

* To run unit tests against only an specify module:

```bash
$ npm run test::unit -- --scope="name-of-the-package"
```

* To run unit tests for each time a file is changed in a package:

```bash
$ cd ./packages/name-of-package-folder
$ npm run test::watch
```
Watch is not supported in the package `neo4j-driver`. 

**Warning!** When the change spread across multiple package, it might be need to rebuild the project to the changes be propagated before testing.


## Testing using Testkit

Tests **require** latest [Testkit 5](https://github.com/neo4j-drivers/testkit/tree/5.0), Python3 and Docker.

Testkit is needed to be cloned and configured to run against the Javascript Lite Driver. Use the following steps to configure Testkit.

1. Clone the Testkit repository

```bash 
$ git clone https://github.com/neo4j-drivers/testkit.git
```

2. Under the Testkit folder, install the requirements.

```bash
$ pip3 install -r requirements.txt
```

3. Define some environment variables to configure Testkit

```bash
$ export TEST_DRIVER_NAME=javascript
$ export TEST_DRIVER_REPO=<path for the root folder of driver repository>
```

By default, Testkit will run against the full version of the driver. 
For testing the `neo4j-driver-lite`, the environment variable `TEST_DRIVER_LITE` should be set to `1`. 
For testing the `neo4j-driver-deno`, the environment variable `TEST_DRIVER_DENO` should be set to `1`.

To run test against against some Neo4j version:

```
python3 main.py
```

More details about how to use Testkit could be found on [its repository](https://github.com/neo4j-drivers/testkit/tree/5.0)

## Testing (Legacy)

Tests **require** latest [Boltkit](https://github.com/neo4j-contrib/boltkit) and [Firefox](https://www.mozilla.org/firefox/) to be installed in the system.

Boltkit is needed to start, stop and configure local test database. Boltkit can be installed with the following command:

```
pip3 install --upgrade boltkit
```

To run tests against "default" Neo4j version:

```
./runTests.sh
```

To run tests against specified Neo4j version:

```
./runTests.sh '-e 4.2.0'
```

Simple `npm test` can also be used if you already have a running version of a compatible Neo4j server.

For development, you can have the build tool rerun the tests each time you change
the source code:

```
gulp watch-n-test
```

If the `gulp` command line tool is not available, you might need to install this globally:

```
npm install -g gulp-cli
```

### Testing on windows

To run the same test suite, run `.\runTest.ps1` instead in powershell with admin right.
The admin right is required to start/stop Neo4j properly as a system service.
While there is no need to grab admin right if you are running tests against an existing Neo4j server using `npm test`.
