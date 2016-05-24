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
    npm run start-neo4j -- --neorun.start.args=\'"$1"\'
fi

sleep 2
npm test
