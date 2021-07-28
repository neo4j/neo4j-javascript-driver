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

import neo4j from '../../src'
import sharedNeo4j from '../../test/internal/shared-neo4j'
import { internal } from 'neo4j-driver-core'

const {
  logger: { Logger }
} = internal

describe('#unit Logger', () => {
  it('should create no-op logger when not configured', () => {
    const log = Logger.create({ logging: null })

    log.error('Error! This should be a no-op')
    log.warn('Warn! This should be a no-op')
    log.info('Info! This should be a no-op')
    log.debug('Debug! This should be a no-op')

    expect(log.isErrorEnabled()).toBeFalsy()
    expect(log.isWarnEnabled()).toBeFalsy()
    expect(log.isInfoEnabled()).toBeFalsy()
    expect(log.isDebugEnabled()).toBeFalsy()
  })

  it('should create Logger when configured', () => {
    const logged = []
    const log = memorizingLogger(logged)

    log.error('Error! One')
    log.warn('Warn! Two')
    log.info('Info! Three')
    log.debug('Debug! Four')

    expect(log.isErrorEnabled()).toBeTruthy()
    expect(log.isWarnEnabled()).toBeTruthy()
    expect(log.isInfoEnabled()).toBeTruthy()
    expect(log.isDebugEnabled()).toBeTruthy()

    expect(logged).toEqual([
      { level: 'error', message: 'Error! One' },
      { level: 'warn', message: 'Warn! Two' },
      { level: 'info', message: 'Info! Three' },
      { level: 'debug', message: 'Debug! Four' }
    ])
  })

  it('should log according to the configured log level', () => {
    const logged = []
    const log = memorizingLogger(logged, 'warn')

    log.error('Error! One')
    log.warn('Warn! Two')
    log.info('Info! Three')
    log.debug('Debug! Four')

    expect(logged).toEqual([
      { level: 'error', message: 'Error! One' },
      { level: 'warn', message: 'Warn! Two' }
    ])
  })
})

describe('#integration Logger', () => {
  it('should log when logger configured in the driver', async () => {
    const logged = []
    const config = memorizingLoggerConfig(logged)
    const driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken,
      config
    )

    const session = driver.session()
    await session.run('RETURN 42')

    expect(logged.length).toBeGreaterThan(0)

    const seenLevels = logged.map(log => log.level)
    const seenMessages = logged.map(log => log.message)

    // at least info and debug should've been used
    expect(seenLevels).toContain('info')
    expect(seenLevels).toContain('debug')

    // the executed query should've been logged
    const queryLogged = seenMessages.find(
      message => message.indexOf('RETURN 42') !== -1
    )
    expect(queryLogged).toBeTruthy()

    await session.close()
    await driver.close()
  })

  it('should log debug to console when configured in the driver', async () => {
    const originalConsoleLog = console.log
    const logged = []
    console.log = message => logged.push(message)

    const driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken,
      {
        logging: neo4j.logging.console('debug')
      }
    )

    try {
      const session = driver.session()
      await session.run('RETURN 123456789')

      expect(logged.length).toBeGreaterThan(0)

      // the executed query should've been logged
      const queryLogged = logged.find(
        log =>
          log.indexOf('DEBUG') !== -1 && log.indexOf('RETURN 123456789') !== -1
      )
      expect(queryLogged).toBeTruthy()

      // driver creation should've been logged because it is on info level
      const driverCreationLogged = logged.find(
        log => log.indexOf('driver') !== -1 && log.indexOf('created') !== -1
      )
      expect(driverCreationLogged).toBeTruthy()
    } finally {
      console.log = originalConsoleLog
      await driver.close()
    }
  })

  it('should log info to console when configured in the driver', async () => {
    const originalConsoleLog = console.log
    const logged = []
    console.log = message => logged.push(message)

    const driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken,
      {
        logging: neo4j.logging.console()
      }
    ) // info is the default level

    try {
      const session = driver.session()
      await session.run('RETURN 123456789')
      expect(logged.length).toBeGreaterThan(0)

      // the executed query should not be logged because it is in debug level
      const queryLogged = logged.find(
        log => log.indexOf('RETURN 123456789') !== -1
      )
      expect(queryLogged).toBeFalsy()

      // driver creation should've been logged because it is on info level
      const driverCreationLogged = logged.find(
        log => log.indexOf('driver') !== -1 && log.indexOf('created') !== -1
      )
      expect(driverCreationLogged).toBeTruthy()
    } finally {
      console.log = originalConsoleLog
      await driver.close()
    }
  })
})

function memorizingLogger (logged, level = 'debug') {
  return Logger.create(memorizingLoggerConfig(logged, level))
}

function memorizingLoggerConfig (logged, level = 'debug') {
  return {
    logging: {
      level: level,
      logger: (level, message) => logged.push({ level, message })
    }
  }
}
