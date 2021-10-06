#!/bin/bash

cd ../core 
npm ci
npm run build 
cd ../bolt-connection
npm ci
npm run build
