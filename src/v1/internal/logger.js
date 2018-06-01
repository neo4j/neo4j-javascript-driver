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

const level = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Logger used by the driver to notify about various internal events. Single logger should be used per driver.
 */
class Logger {

  /**
   * @constructor
   * @param {function(level: string, message: string)} loggerFunction the function to delegate to.
   */
  constructor(loggerFunction) {
    this._loggerFunction = loggerFunction;
  }

  /**
   * Create a new logger based on the given driver configuration.
   * @param {object} driverConfig the driver configuration as supplied by the user.
   * @return {Logger} a new logger instance or a no-op logger when not configured.
   */
  static create(driverConfig) {
    if (driverConfig && driverConfig.logger && typeof driverConfig.logger === 'function') {
      return new Logger(driverConfig.logger);
    }
    return this.noOp();
  }

  /**
   * Get the no-op logger implementation.
   * @return {Logger} the no-op logger implementation.
   */
  static noOp() {
    return noOpLogger;
  }

  /**
   * Check if logger is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} <code>true</code> when logger is not a no-op, <code>false</code> otherwise.
   */
  isEnabled() {
    return true;
  }

  /**
   * Log an error message.
   * @param {string} message the message to log.
   */
  error(message) {
    this._loggerFunction(level.ERROR, message);
  }

  /**
   * Log an warning message.
   * @param {string} message the message to log.
   */
  warn(message) {
    this._loggerFunction(level.WARN, message);
  }

  /**
   * Log an info message.
   * @param {string} message the message to log.
   */
  info(message) {
    this._loggerFunction(level.INFO, message);
  }

  /**
   * Log a debug message.
   * @param {string} message the message to log.
   */
  debug(message) {
    this._loggerFunction(level.DEBUG, message);
  }
}

class NoOpLogger extends Logger {

  constructor() {
    super(null);
  }

  isEnabled() {
    return false;
  }

  error() {
  }

  warn() {
  }

  info() {
  }

  debug() {
  }
}

const noOpLogger = new NoOpLogger();

export default Logger;
