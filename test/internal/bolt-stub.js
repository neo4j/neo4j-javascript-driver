/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import sharedNeo4j from './shared-neo4j';
import neo4j from '../../src/v1/index';

class UnsupportedBoltStub {

  start(script, port) {
    throw new Error('BoltStub: unable to start, unavailable on this platform');
  }

  startWithTemplate(scriptTemplate, parameters, port) {
    throw new Error('BoltStub: unable to start with template, unavailable on this platform');
  }

  run(callback) {
    throw new Error('BoltStub: unable to run, unavailable on this platform');
  }
}

const verbose = false; // for debugging purposes

class SupportedBoltStub extends UnsupportedBoltStub {

  constructor() {
    super();
    this._childProcess = require('child_process');
    this._mustache = require('mustache');
    this._fs = require('fs');
    this._tmp = require('tmp');
  }

  static create() {
    try {
      return new SupportedBoltStub();
    } catch (e) {
      return null;
    }
  }

  start(script, port) {
    const boltStub = this._childProcess.spawn('boltstub', ['-v', port, script]);

    if (verbose) {
      boltStub.stdout.on('data', (data) => {
        console.log(`${data}`);
      });
      boltStub.stderr.on('data', (data) => {
        console.log(`${data}`);
      });
      boltStub.on('end', data => {
        console.log(data);
      });
    }

    let exitCode = -1;
    boltStub.on('close', code => {
      exitCode = code;
    });

    boltStub.on('error', error => {
      console.log('Failed to start child process:' + error);
    });

    return new StubServer(() => exitCode);
  }

  startWithTemplate(scriptTemplate, parameters, port) {
    const template = this._fs.readFileSync(scriptTemplate, 'utf-8');
    const scriptContents = this._mustache.render(template, parameters);
    const script = this._tmp.fileSync().name;
    this._fs.writeFileSync(script, scriptContents, 'utf-8');
    return this.start(script, port);
  }

  run(callback) {
    // wait to make sure boltstub is started before running user code
    setTimeout(callback, 1000);
  }
}

class StubServer {

  constructor(exitCodeSupplier) {
    this._exitCodeSupplier = exitCodeSupplier;
    this.exit.bind(this);
  }

  exit(callback) {
    // give process some time to exit
    setTimeout(() => {
      callback(this._exitCodeSupplier());
    }, 1000);
  }
}

function newDriver(url) {
  // boltstub currently does not support encryption, create driver with encryption turned off
  const config = {
    encrypted: 'ENCRYPTION_OFF'
  };
  return neo4j.driver(url, sharedNeo4j.authToken, config);
}

const supportedStub = SupportedBoltStub.create();
const supported = supportedStub != null;
const stub = supported ? supportedStub : new UnsupportedBoltStub();

export default {
  supported: supported,
  start: stub.start.bind(stub),
  startWithTemplate: stub.startWithTemplate.bind(stub),
  run: stub.run.bind(stub),
  newDriver: newDriver
};
