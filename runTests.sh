#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm install

if [ "$1" == "" ]; then
    npm run start-neo4j
else
    # Example: ./runTests.sh '-v 3.0.1 -p neo4j'
    # Example: npm run start-neo4j -- --neorun.start.args='-v 3.0.1 -p neo4j'
    NEORUN_START_ARGS="$1" npm run start-neo4j
fi

sleep 2
npm test
