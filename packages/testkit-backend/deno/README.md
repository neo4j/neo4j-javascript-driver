# Deno-Specific Testkit Backend Implementations

This directory contains Deno specific implementations which depend on having
`Deno` global variable available or being able to load `Deno` specific libraries
such as the `Neo4j Deno Module`. Files like `../feature/deno.js` and
`../skipped-tests/deno.js` are outside this directory since they are pure
javascript configuration files, and they don't depend on the environment.

## Starting Backend

### Pre-Requisites

First, you need to build the `Neo4j Deno Module` by running
`npm run build::deno` in the repository root folder.

### The Start Command

For starting this backend, you should run the following command in this
directory:

```
deno run --allow-read --allow-write --allow-net --allow-env --allow-run index.ts
```

Alternatively, you could run `'npm run start::deno'` in the root package of the
`testkit-backend` or `npm run start-testkit-backend::deno` in the repository
root folder.

## Project Structure

- `index.ts` is responsible for configuring the backend to run.
- `channel.ts` is responsible for the communication with testkit.
- `controller.ts` is responsible for routing the request to the service.
