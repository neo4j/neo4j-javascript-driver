#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm --prefix ./core/ ci
npm --prefix ./core/ test
npm --prefix ./core/ run build
npm --prefix ./bolt-connection/ ci
npm --prefix ./bolt-connection/ test
npm --prefix ./bolt-connection/ run build

npm ci

if [[ ! -z "$1" ]]; then
  export NEOCTRL_ARGS="$1"
fi

npm run start-neo4j && npm test
