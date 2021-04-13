#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm install -g gulp typescript jest

./buildDependencies.sh

npm ci

if [[ ! -z "$1" ]]; then
  export NEOCTRL_ARGS="$1"
fi

npm --prefix ./core/ test
npm --prefix ./bolt-connection/ test

npm run start-neo4j && npm test
