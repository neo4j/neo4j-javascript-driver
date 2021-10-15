#!/bin/bash

function finish {
  npm run stop-neo4j
}
trap finish EXIT

npm ci
npm run build -- --no-private

# root users could not run the lifecycle scripts
# so it need will need to run the prepare script 
if [ "$EUID" -eq 0 ]
  then echo "Running prepare by manually"
  npm run lerna -- run prepare --no-private  
fi


if [[ ! -z "$1" ]]; then
  export NEOCTRL_ARGS="$1"
fi

npm run start-neo4j && npm test -- --no-private
