/**
 * Copyright (c) "Neo4j"
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

import sharedNeo4j from './shared-neo4j'
import neo4j from '../../src'

class UnsupportedBoltStub {
  start (script, port) {
    throw new Error('BoltStub: unable to start, unavailable on this platform')
  }

  startWithTemplate (scriptTemplate, parameters, port) {
    throw new Error(
      'BoltStub: unable to start with template, unavailable on this platform'
    )
  }
}

const verbose = (process.env.NEOLOGLEVEL || 'error').toLowerCase() === 'debug' // for debugging purposes

class SupportedBoltStub extends UnsupportedBoltStub {
  constructor () {
    super()
    this._childProcess = require('child_process')
    this._mustache = require('mustache')
    this._fs = require('fs')
    this._tmp = require('tmp')
    this._net = require('net')
  }

  static create () {
    try {
      return new SupportedBoltStub()
    } catch (e) {
      return null
    }
  }

  start (script, port) {
    const boltStub = this._childProcess.spawn('python3', [
      '-m',
      'boltkit',
      'stub',
      '-v',
      '-l',
      'localhost:' + port,
      script
    ])

    if (verbose) {
      boltStub.stdout.on('data', data => {
        console.warn(`${data}`)
      })
      boltStub.stderr.on('data', data => {
        console.warn(`${data}`)
      })
      boltStub.on('end', data => {
        console.warn(data)
      })
    }

    let exited = false
    let exitCode = -1
    boltStub.on('close', code => {
      exited = true
      exitCode = code
    })

    boltStub.on('error', error => {
      console.warn('Failed to start child process:' + error)
    })

    return new Promise((resolve, reject) => {
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        reject(`unable to connect to localhost:${port}`)
      }, 15000)

      const tryConnect = () => {
        const client = this._net.createConnection({ port }, () => {
          clearTimeout(timeoutId)
          resolve(
            new StubServer(() => {
              return {
                exited: exited,
                code: exitCode
              }
            })
          )
        })
        client.on('error', () => {
          if (!timedOut) {
            setTimeout(tryConnect, 200)
          }
        })
      }

      tryConnect()
    })
  }

  startWithTemplate (scriptTemplate, parameters, port) {
    const template = this._fs.readFileSync(scriptTemplate, 'utf-8')
    const scriptContents = this._mustache.render(template, parameters)
    const script = this._tmp.fileSync().name
    this._fs.writeFileSync(script, scriptContents, 'utf-8')
    return this.start(script, port)
  }
}

class StubServer {
  constructor (exitStatusSupplier) {
    this._exitStatusSupplier = exitStatusSupplier
    this.exit.bind(this)
  }

  exit () {
    return new Promise((resolve, reject) => {
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        reject('timed out waiting for the stub server to exit')
      }, 5000)

      const checkStatus = () => {
        const exitStatus = this._exitStatusSupplier()
        if (exitStatus.exited) {
          clearTimeout(timeoutId)

          if (exitStatus.code === 0) {
            resolve()
          } else {
            reject(`stub server exited with code: ${exitStatus.code}`)
          }
        } else {
          if (!timedOut) {
            setTimeout(() => checkStatus(), 500)
          }
        }
      }

      checkStatus()
    })
  }
}

function newDriver (url, config = {}) {
  // left here for debugging purposes
  const logging = {
    level: (process.env.NEOLOGLEVEL || 'error').toLowerCase(),
    logger: (level, msg) => console.warn(`${level}: ${msg}`)
  }
  // boltstub currently does not support encryption, create driver with encryption turned off
  const newConfig = Object.assign(
    { encrypted: 'ENCRYPTION_OFF', logging },
    config
  )
  return neo4j.driver(url, sharedNeo4j.authToken, newConfig)
}

const supportedStub = SupportedBoltStub.create()
const supported = supportedStub != null
const stub = supported ? supportedStub : new UnsupportedBoltStub()

export default {
  supported: supported,
  start: stub.start.bind(stub),
  startWithTemplate: stub.startWithTemplate.bind(stub),
  newDriver: newDriver
}
