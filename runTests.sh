#!/bin/bash

function finish {
  gulp stop-neo4j
}
trap finish EXIT

npm install
gulp start-neo4j
gulp test