#!/bin/bash

npm --prefix core ci
npm --prefix core run build
npm --prefix bolt-connection ci
npm --prefix bolt-connection run build
