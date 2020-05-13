/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import neo4j from '../../src'
import { ServerVersion } from '../../src/internal/server-version'

class UnsupportedPlatform {
  pathJoin () {
    throw new Error("Module 'path' is not available on this platform")
  }

  spawn (command, args) {
    throw new Error("Module 'child_process' is not available on this platform")
  }

  listDir (path) {
    throw new Error("Module 'fs' is not available on this platform")
  }

  removeDir (path) {
    throw new Error("Module 'fs' is not available on this platform")
  }

  moveDir (from, to) {
    throw new Error("Module 'fs' is not available on this platform")
  }

  isDirectory (path) {
    throw new Error("Module 'fs' is not available on this platform")
  }

  env (key) {
    throw new Error("Module 'process' is not available on this platform")
  }

  cwd () {
    throw new Error("Module 'process' is not available on this platform")
  }
}

class SupportedPlatform extends UnsupportedPlatform {
  constructor () {
    super()
    this._path = require('path')
    this._childProcess = require('child_process')
    this._fs = require('fs-extra')
    this._process = require('process')
  }

  static create () {
    try {
      return new SupportedPlatform()
    } catch (e) {
      return null
    }
  }

  pathJoin () {
    return this._path.join(...Array.from(arguments))
  }

  spawn (command, args) {
    const options = {
      // ignore stdin, use default values for stdout and stderr
      // otherwise spawned java process does not see IPv6 address of the local interface and Neo4j fails to start
      // https://github.com/nodejs/node-v0.x-archive/issues/7406
      stdio: ['ignore', null, null]
    }
    return this._childProcess.spawnSync(command, args, options)
  }

  listDir (path) {
    return this._fs.readdirSync(path)
  }

  removeDir (path) {
    if (this.isDirectory(path)) {
      this._fs.removeSync(path)
    }
  }

  moveDir (from, to) {
    this._fs.moveSync(from, to, { overwrite: true })
  }

  isDirectory (path) {
    try {
      this._fs.accessSync(path)
      const stat = this._fs.statSync(path)
      return stat.isDirectory()
    } catch (e) {
      return false
    }
  }

  env (key) {
    return this._process.env[key]
  }

  cwd () {
    return this._process.cwd()
  }
}

const platform = SupportedPlatform.create() || new UnsupportedPlatform()

const username = 'neo4j'
const password = 'password'
const authToken = neo4j.auth.basic(username, password)

const tlsConfig = {
  key: 'dbms.connector.bolt.tls_level',
  levels: {
    optional: 'OPTIONAL',
    required: 'REQUIRED',
    disabled: 'DISABLED'
  }
}

const defaultConfig = {
  // tell neo4j to listen for IPv6 connections, only supported by 3.1+
  'dbms.connectors.default_listen_address': '::',

  // HTTP server should keep listening on default address
  'dbms.connector.http.listen_address': 'localhost:7474',

  // shorten the default time to wait for the bookmark from 30 to 5 seconds
  'dbms.transaction.bookmark_ready_timeout': '5s',

  // make TLS optional
  'dbms.connector.bolt.tls_level': tlsConfig.levels.optional
}

const NEOCTRL_ARGS = 'NEOCTRL_ARGS'
const neoCtrlVersionParam = '-e'
const defaultNeo4jVersion = '4.1'
const defaultNeoCtrlArgs = `${neoCtrlVersionParam} ${defaultNeo4jVersion}`

function neoctrlArgs () {
  return platform.env(NEOCTRL_ARGS) || defaultNeoCtrlArgs
}

function neoctrlVersion () {
  return neoctrlArgs()
    .replace(/-e/, '')
    .trim()
}

function neo4jDir () {
  return platform.pathJoin(
    platform.cwd(),
    'build',
    'neo4j',
    neoctrlVersion(),
    'neo4jHome'
  )
}

function neo4jCertPath () {
  return platform.pathJoin(neo4jDir(), 'certificates', 'neo4j.cert')
}

function neo4jKeyPath () {
  return platform.pathJoin(neo4jDir(), 'certificates', 'neo4j.key')
}

function install () {
  const targetDir = neo4jDir()

  if (platform.isDirectory(targetDir)) {
    console.log(
      `Found existing Neo4j ${neoctrlVersion()} installation at "${targetDir}"`
    )
  } else {
    const installDir = platform.pathJoin(targetDir, '..')
    // first delete any existing data inside our target folder
    platform.removeDir(installDir)

    const installArgs = neoctrlArgs()
      .split(' ')
      .map(a => a.trim())
    installArgs.push(installDir)

    console.log(`Installing neo4j with arguments "${installArgs}"`)
    const result = runCommand('neoctrl-install', installArgs)
    if (!result.successful) {
      throw new Error('Unable to install Neo4j.\n' + result.fullOutput)
    }

    const installedNeo4jDir = result.stdout
    platform.moveDir(installedNeo4jDir, targetDir)
    console.log(`Installed neo4j into "${targetDir}"`)
  }
}

function configure (config) {
  console.log(
    `Configuring neo4j at "${neo4jDir()}" with "${JSON.stringify(config)}"`
  )

  const configEntries = Object.keys(config).map(key => `${key}=${config[key]}`)
  if (configEntries.length > 0) {
    const result = runCommand('neoctrl-configure', [
      neo4jDir(),
      ...configEntries
    ])
    if (!result.successful) {
      throw new Error(`Unable to configure neo4j.\n${result.fullOutput}`)
    }

    console.log('Configuration complete.')
  }
}

function createUser (username, password) {
  console.log(`Creating user "${username}" on neo4j at "${neo4jDir()}".`)

  const result = runCommand('neoctrl-create-user', [
    neo4jDir(),
    username,
    password
  ])
  if (!result.successful) {
    throw new Error(`Unable to create user on neo4j.\n${result.fullOutput}`)
  }
  console.log('User created.')
}

function startNeo4j () {
  console.log(`Starting neo4j at "${neo4jDir()}".`)
  const result = runCommand('neoctrl-start', [neo4jDir()])
  if (!result.successful) {
    throw new Error(`Unable to start.\n${result.fullOutput}`)
  }
  console.log('Neo4j started.')
}

function stopNeo4j () {
  console.log(`Stopping neo4j at "${neo4jDir()}".`)
  const result = runCommand('neoctrl-stop', [neo4jDir()])
  if (!result.successful) {
    throw new Error(`Unable to stop.\n${result.fullOutput}`)
  }
  console.log('Neo4j stopped.')
}

function start () {
  const boltKitCheckResult = runCommand('neoctrl-install', ['-h'])

  if (boltKitCheckResult.successful) {
    install()
    configure(defaultConfig)
    createUser(username, password)
    startNeo4j()
  } else {
    console.warn(
      "Boltkit unavailable. Please install it by running 'pip install --upgrade boltkit."
    )
    console.warn('Integration tests will be skipped.')
    console.warn(
      "Command 'neoctrl-install -h' resulted in\n" +
        boltKitCheckResult.fullOutput
    )
  }
}

function stop () {
  stopNeo4j()
}

function restart (configOverride) {
  stopNeo4j()
  const newConfig = Object.assign({}, defaultConfig)
  if (configOverride) {
    Object.keys(configOverride).forEach(
      key => (newConfig[key] = configOverride[key])
    )
  }
  configure(newConfig)
  startNeo4j()
}

async function cleanupAndGetVersion (driver) {
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE })
  try {
    const result = await session.run('MATCH (n) DETACH DELETE n')
    return ServerVersion.fromString(result.summary.server.version)
  } finally {
    await session.close()
  }
}

async function getEdition (driver) {
  const session = driver.session({ defaultAccessMode: neo4j.session.READ })
  try {
    const result = await session.run('CALL dbms.components() YIELD edition')
    const singleRecord = result.records[0]
    return singleRecord.get(0)
  } finally {
    await session.close()
  }
}

function runCommand (command, args) {
  const spawnResult = platform.spawn(command, args)
  return new RunCommandResult(spawnResult)
}

class RunCommandResult {
  constructor (spawnResult) {
    this.successful = spawnResult.status === 0
    this.stdout = (spawnResult.stdout || '').toString().trim()
    this.stderr = (spawnResult.stderr || '').toString().trim()
    this.fullOutput =
      'STDOUT:\n\t' +
      this.stdout +
      '\n' +
      'STDERR:\n\t' +
      this.stderr +
      '\n' +
      'EXIT CODE:\n\t' +
      spawnResult.status +
      '\n' +
      'ERROR:\n\t' +
      spawnResult.error +
      '\n'
  }
}

const debugLogging = {
  level: 'debug',
  logger: (level, message) => console.warn(`${level}: ${message}`)
}

export default {
  start: start,
  stop: stop,
  restart: restart,
  neo4jCertPath: neo4jCertPath,
  neo4jKeyPath: neo4jKeyPath,
  username: username,
  password: password,
  authToken: authToken,
  logging: debugLogging,
  cleanupAndGetVersion: cleanupAndGetVersion,
  tlsConfig: tlsConfig,
  getEdition: getEdition
}
