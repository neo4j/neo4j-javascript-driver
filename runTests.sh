#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm ci
npm run build -- --no-private

if [[ ! -z "$1" ]]; then
  export NEOCTRL_ARGS="$1"
fi

npm run start-neo4j && npm test -- --no-private
