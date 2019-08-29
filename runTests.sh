#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT


npm install

if [[ ! -z "$1" ]]; then
  export NEOCTRL_ARGS="$1"
fi

npm run start-neo4j && npm test
