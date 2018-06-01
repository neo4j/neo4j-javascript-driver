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
import sharedNeo4j from '../../test/internal/shared-neo4j';
import Logger from '../../src/v1/internal/logger';

describe('Logger', () => {

  let originalConsoleLog;

  beforeEach(() => {
    originalConsoleLog = console.log;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should create NoOpLogger when not configured', () => {
    const log = Logger.create({logger: null});

    log.error('Error! This should be a no-op');
    log.warn('Warn! This should be a no-op');
    log.info('Info! This should be a no-op');
    log.debug('Debug! This should be a no-op');

    expect(log.constructor.name).toEqual('NoOpLogger');
    expect(log.isEnabled()).toBeFalsy();
  });

  it('should create Logger when configured', () => {
    const logged = [];
    const log = Logger.create({logger: (level, message) => logged.push({level, message})});

    log.error('Error! One');
    log.warn('Warn! Two');
    log.info('Info! Three');
    log.debug('Debug! Four');

    expect(log.constructor.name).toEqual('Logger');
    expect(log.isEnabled()).toBeTruthy();
    expect(logged).toEqual([
      {level: 'error', message: 'Error! One'},
      {level: 'warn', message: 'Warn! Two'},
      {level: 'info', message: 'Info! Three'},
      {level: 'debug', message: 'Debug! Four'}
    ]);
  });

  it('should log when logger configured in the driver', done => {
    const logged = [];
    const config = {
      logger: (level, message) => logged.push({level, message})
    };
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, config);

    const session = driver.session();
    session.run('RETURN 42')
      .then(() => {
        expect(logged.length).toBeGreaterThan(0);

        const seenLevels = logged.map(log => log.level);
        const seenMessages = logged.map(log => log.message);

        // at least info and debug should've been used
        expect(seenLevels).toContain('info');
        expect(seenLevels).toContain('debug');

        // the executed statement should've been logged
        const statementLogged = seenMessages.find(message => message.indexOf('RETURN 42') !== -1);
        expect(statementLogged).toBeTruthy();
      })
      .catch(error => {
        done.fail(error);
      })
      .then(() => {
        driver.close();
        done();
      });
  });

  it('should log to console when configured in the driver', done => {
    const logged = [];
    console.log = message => logged.push(message);
    const config = {
      logger: neo4j.logger.console
    };
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, config);

    const session = driver.session();
    session.run('RETURN 123456789')
      .then(() => {
        expect(logged.length).toBeGreaterThan(0);

        // the executed statement should've been logged
        const statementLogged = logged.find(log => log.indexOf('RETURN 123456789') !== -1);
        expect(statementLogged).toBeTruthy();
      })
      .catch(error => {
        done.fail(error);
      })
      .then(() => {
        driver.close();
        done();
      });
  });

});
