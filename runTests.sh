#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm install
npm run start-neo4j
#npm run start-neo4j -- --neorun.start.args='-v 3.0.1 -p neo4j'
sleep 2
npm test
