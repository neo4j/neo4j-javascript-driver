/**
 * Copyright (c) 2002-2019 "Neo4j,"
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
import {newError} from '../error';

const ERROR = 'error';
const WARN = 'warn';
const INFO = 'info';
const DEBUG = 'debug';

const DEFAULT_LEVEL = INFO;

const levels = {
  [ERROR]: 0,
  [WARN]: 1,
  [INFO]: 2,
  [DEBUG]: 3
};

/**
 * Logger used by the driver to notify about various internal events. Single logger should be used per driver.
 */
class Logger {

  /**
   * @constructor
   * @param {string} level the enabled logging level.
   * @param {function(level: string, message: string)} loggerFunction the function to write the log level and message.
   */
  constructor(level, loggerFunction) {
    this._level = level;
    this._loggerFunction = loggerFunction;
  }

  /**
   * Create a new logger based on the given driver configuration.
   * @param {object} driverConfig the driver configuration as supplied by the user.
   * @return {Logger} a new logger instance or a no-op logger when not configured.
   */
  static create(driverConfig) {
    if (driverConfig && driverConfig.logging) {
      const loggingConfig = driverConfig.logging;
      const level = extractConfiguredLevel(loggingConfig);
      const loggerFunction = extractConfiguredLogger(loggingConfig);
      return new Logger(level, loggerFunction);
    }
    return this.noOp();
  }

  /**
   * Create a no-op logger implementation.
   * @return {Logger} the no-op logger implementation.
   */
  static noOp() {
    return noOpLogger;
  }

  /**
   * Check if error logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isErrorEnabled() {
    return isLevelEnabled(this._level, ERROR);
  }

  /**
   * Log an error message.
   * @param {string} message the message to log.
   */
  error(message) {
    if (this.isErrorEnabled()) {
      this._loggerFunction(ERROR, message);
    }
  }

  /**
   * Check if warn logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isWarnEnabled() {
    return isLevelEnabled(this._level, WARN);
  }

  /**
   * Log an warning message.
   * @param {string} message the message to log.
   */
  warn(message) {
    if (this.isWarnEnabled()) {
      this._loggerFunction(WARN, message);
    }
  }

  /**
   * Check if info logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isInfoEnabled() {
    return isLevelEnabled(this._level, INFO);
  }

  /**
   * Log an info message.
   * @param {string} message the message to log.
   */
  info(message) {
    if (this.isInfoEnabled()) {
      this._loggerFunction(INFO, message);
    }
  }

  /**
   * Check if debug logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isDebugEnabled() {
    return isLevelEnabled(this._level, DEBUG);
  }

  /**
   * Log a debug message.
   * @param {string} message the message to log.
   */
  debug(message) {
    if (this.isDebugEnabled()) {
      this._loggerFunction(DEBUG, message);
    }
  }
}

class NoOpLogger extends Logger {

  constructor() {
    super(null, null);
  }

  isErrorEnabled() {
    return false;
  }

  error(message) {
  }

  isWarnEnabled() {
    return false;
  }

  warn(message) {
  }

  isInfoEnabled() {
    return false;
  }

  info(message) {
  }

  isDebugEnabled() {
    return false;
  }

  debug(message) {
  }
}

const noOpLogger = new NoOpLogger();

/**
 * Check if the given logging level is enabled.
 * @param {string} configuredLevel the configured level.
 * @param {string} targetLevel the level to check.
 * @return {boolean} value of `true` when enabled, `false` otherwise.
 */
function isLevelEnabled(configuredLevel, targetLevel) {
  return levels[configuredLevel] >= levels[targetLevel];
}

/**
 * Extract the configured logging level from the driver's logging configuration.
 * @param {object} loggingConfig the logging configuration.
 * @return {string} the configured log level or default when none configured.
 */
function extractConfiguredLevel(loggingConfig) {
  if (loggingConfig && loggingConfig.level) {
    const configuredLevel = loggingConfig.level;
    const value = levels[configuredLevel];
    if (!value && value !== 0) {
      throw newError(`Illegal logging level: ${configuredLevel}. Supported levels are: ${Object.keys(levels)}`);
    }
    return configuredLevel;
  }
  return DEFAULT_LEVEL;
}

/**
 * Extract the configured logger function from the driver's logging configuration.
 * @param {object} loggingConfig the logging configuration.
 * @return {function(level: string, message: string)} the configured logging function.
 */
function extractConfiguredLogger(loggingConfig) {
  if (loggingConfig && loggingConfig.logger) {
    const configuredLogger = loggingConfig.logger;
    if (configuredLogger && typeof configuredLogger === 'function') {
      return configuredLogger;
    }
  }
  throw newError(`Illegal logger function: ${loggingConfig.logger}`);
}

export default Logger;
