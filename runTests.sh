#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm install

if [ "$1" == "" ]; then
    npm run start-neo4j
else
    # Example: ./runTests.sh '-e 3.1.3'
    NEOCTRL_ARGS="$1" npm run start-neo4j
fi

sleep 2
npm test
