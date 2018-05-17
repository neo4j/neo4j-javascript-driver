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

import neo4j from '../../src/v1';

class UnsupportedPlatform {

  pathJoin() {
    throw new Error('Module \'path\' is not available on this platform');
  }

  spawn(command, args) {
    throw new Error('Module \'child_process\' is not available on this platform');
  }

  listDir(path) {
    throw new Error('Module \'fs\' is not available on this platform');
  }

  removeDir(path) {
    throw new Error('Module \'fs\' is not available on this platform');
  }

  isDirectory(path) {
    throw new Error('Module \'fs\' is not available on this platform');
  }
}

class SupportedPlatform extends UnsupportedPlatform {

  constructor() {
    super();
    this._path = require('path');
    this._childProcess = require('child_process');
    this._fs = require('fs-extra');
  }

  static create() {
    try {
      return new SupportedPlatform();
    } catch (e) {
      return null;
    }
  }

  pathJoin() {
    return this._path.join(...Array.from(arguments));
  }

  spawn(command, args) {
    const options = {
      // ignore stdin, use default values for stdout and stderr
      // otherwise spawned java process does not see IPv6 address of the local interface and Neo4j fails to start
      // https://github.com/nodejs/node-v0.x-archive/issues/7406
      stdio: ['ignore', null, null]
    };
    return this._childProcess.spawnSync(command, args, options);
  }

  listDir(path) {
    return this._fs.readdirSync(path);
  }

  removeDir(path) {
    if (this.isDirectory(path)) {
      this._fs.removeSync(path);
    }
  }

  isDirectory(path) {
    try {
      this._fs.accessSync(path);
      const stat = this._fs.statSync(path);
      return stat.isDirectory();
    } catch (e) {
      return false;
    }
  }
}

const platform = SupportedPlatform.create() || new UnsupportedPlatform();

const username = 'neo4j';
const password = 'password';
const authToken = neo4j.auth.basic(username, password);

const additionalConfig = {
  // tell neo4j to listen for IPv6 connections, only supported by 3.1+
  'dbms.connectors.default_listen_address': '::',

  // HTTP server should keep listening on default address and create a self-signed certificate with host 'localhost'
  'dbms.connector.http.listen_address': 'localhost:7474'
};

const neoCtrlVersionParam = '-e';
const defaultNeo4jVersion = '3.3.4';
const defaultNeoCtrlArgs = `${neoCtrlVersionParam} ${defaultNeo4jVersion}`;

function neo4jCertPath(dir) {
  const neo4jDir = findExistingNeo4jDirStrict(dir);
  return platform.pathJoin(neo4jDir, 'certificates', 'neo4j.cert');
}

function neo4jKeyPath(dir) {
  const neo4jDir = findExistingNeo4jDirStrict(dir);
  return platform.pathJoin(neo4jDir, 'certificates', 'neo4j.key');
}

function start(dir, givenNeoCtrlArgs) {
  const boltKitCheckResult = runCommand('neoctrl-install', ['-h']);

  if (boltKitCheckResult.successful) {
    const neo4jDir = installNeo4j(dir, givenNeoCtrlArgs);
    configureNeo4j(neo4jDir);
    createDefaultUser(neo4jDir);
    startNeo4j(neo4jDir);
  } else {
    console.log('Boltkit unavailable. Please install it by running \'pip install --upgrade boltkit.');
    console.log('Integration tests will be skipped.');
    console.log('Command \'neoctrl-install -h\' resulted in\n' + boltKitCheckResult.fullOutput);
  }
}

function stop(dir) {
  const neo4jDir = findExistingNeo4jDirStrict(dir);
  stopNeo4j(neo4jDir);
}

function restart(dir) {
  const neo4jDir = findExistingNeo4jDirStrict(dir);
  stopNeo4j(neo4jDir);
  startNeo4j(neo4jDir);
}

function installNeo4j(dir, givenNeoCtrlArgs) {
  const neoCtrlArgs = givenNeoCtrlArgs || defaultNeoCtrlArgs;
  const argsArray = neoCtrlArgs.split(' ').map(value => value.trim());
  argsArray.push(dir);

  const neo4jVersion = extractNeo4jVersion(argsArray);
  const existingNeo4jDir = findExistingNeo4jDir(dir, neo4jVersion);
  if (existingNeo4jDir) {
    console.log('Found existing Neo4j ' + neo4jVersion + ' installation at: \'' + existingNeo4jDir + '\'');
    return existingNeo4jDir;
  } else {
    platform.removeDir(dir);

    console.log('Installing Neo4j with neoctrl arguments: \'' + neoCtrlArgs + '\'');
    const result = runCommand('neoctrl-install', argsArray);
    if (!result.successful) {
      throw new Error('Unable to install Neo4j.\n' + result.fullOutput);
    }

    const installedNeo4jDir = result.stdout;
    console.log('Installed Neo4j to: \'' + installedNeo4jDir + '\'');
    return installedNeo4jDir;
  }
}

function configureNeo4j(neo4jDir) {
  console.log('Configuring Neo4j at: \'' + neo4jDir + '\' with ' + JSON.stringify(additionalConfig));

  const configEntries = Object.keys(additionalConfig).map(key => `${key}=${additionalConfig[key]}`);
  const configureResult = runCommand('neoctrl-configure', [neo4jDir, ...configEntries]);
  if (!configureResult.successful) {
    throw new Error('Unable to configure Neo4j.\n' + configureResult.fullOutput);
  }

  console.log('Configured Neo4j at: \'' + neo4jDir + '\'');
}

function createDefaultUser(neo4jDir) {
  console.log('Creating user \'' + username + '\' for Neo4j at: \'' + neo4jDir + '\'');
  const result = runCommand('neoctrl-create-user', [neo4jDir, username, password]);
  if (!result.successful) {
    throw new Error('Unable to create user: \'' + username + '\' for Neo4j at: ' + neo4jDir + '\'\n' + result.fullOutput);
  }
  console.log('Created user \'' + username + '\' for Neo4j at: \'' + neo4jDir + '\'');
}

function startNeo4j(neo4jDir) {
  console.log('Starting Neo4j at: \'' + neo4jDir + '\'');
  const result = runCommand('neoctrl-start', [neo4jDir]);
  if (!result.successful) {
    throw new Error('Unable to start Neo4j.\n' + result.fullOutput);
  }
  console.log('Started Neo4j at: \'' + neo4jDir + '\'');
}

function stopNeo4j(neo4jDir) {
  console.log('Stopping Neo4j at: \'' + neo4jDir + '\'');
  const result = runCommand('neoctrl-stop', [neo4jDir]);
  if (!result.successful) {
    throw new Error('Unable to stop Neo4j at: \'' + neo4jDir + '\'\n' + result.fullOutput);
  }
}

function findExistingNeo4jDirStrict(dir) {
  const neo4jDir = findExistingNeo4jDir(dir, null);
  if (!neo4jDir) {
    throw new Error(`Unable to find Neo4j dir in: '${dir}'`);
  }
  return neo4jDir;
}

function findExistingNeo4jDir(dir, neo4jVersion) {
  if (!platform.isDirectory(dir)) {
    return null;
  }

  const dirs = platform.listDir(dir).filter(entry => isNeo4jDir(entry, neo4jVersion))
    .map(entry => platform.pathJoin(dir, entry))
    .filter(entry => platform.isDirectory(entry));

  return dirs.length === 1 ? dirs[0] : null;
}

function isNeo4jDir(name, version) {
  if (!name.startsWith('neo4j')) {
    return false;
  }
  if (version && name.indexOf(version) === -1) {
    return false;
  }
  return true;
}

function extractNeo4jVersion(neoCtrlArgs) {
  const index = neoCtrlArgs.indexOf(neoCtrlVersionParam);
  if (index === -1) {
    throw new Error(`No '${neoCtrlVersionParam}' parameter`);
  }

  const version = neoCtrlArgs[index + 1];
  if (!version) {
    throw new Error(`Version is undefined in: ${neoCtrlArgs}`);
  }

  return version.trim();
}

function runCommand(command, args) {
  const spawnResult = platform.spawn(command, args);
  return new RunCommandResult(spawnResult);
}

class RunCommandResult {

  constructor(spawnResult) {
    this.successful = spawnResult.status === 0;
    this.stdout = (spawnResult.stdout || '').toString().trim();
    this.stderr = (spawnResult.stderr || '').toString().trim();
    this.fullOutput = 'STDOUT:\n\t' + this.stdout + '\n' +
      'STDERR:\n\t' + this.stderr + '\n' +
      'EXIT CODE:\n\t' + spawnResult.status + '\n' +
      'ERROR:\n\t' + spawnResult.error + '\n';
  }
}

export default {
  start: start,
  stop: stop,
  restart: restart,
  neo4jCertPath: neo4jCertPath,
  neo4jKeyPath: neo4jKeyPath,
  username: username,
  password: password,
  authToken: authToken
};
