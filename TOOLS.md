# List of tools used throughout the project

### npm

Used for dependency management

#### Common commands

`NEOCTRL_ARGS="-e 4.1" npm test`

`NEOCTRL_ARGS="-e 4.1" npm run start-neo4j`

`NEOCTRL_ARGS="-e 4.1" npm run stop-neo4j`

### gulp

Used for build system

The following commands run tests directly from the source tree compared to `npm test` which runs them in a sandboxed environment.

`NEOCTRL_ARGS="-e 4.1" gulp test-nodejs-unit`

`NEOCTRL_ARGS="-e 4.1" gulp test-nodejs-integration`

`NEOCTRL_ARGS="-e 4.1" gulp test-nodejs-stub`

### jasmine

Used as the testing and assertion framework

`jasmine --filter="#unit Test"` for more fine-grained test filtering. This only applies to node environment tests.

### karma

Used for running tests in real browsers

`gulp test-browser`

### istanbul & nyc

Used for code coverage

`nyc jasmine --filter="#unit"` cover unit tests

### eslint

For linting

### prettier-eslint

For code styling

### husky

For github pre-commit hooks for code styling
