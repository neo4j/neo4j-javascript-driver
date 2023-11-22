/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import { newError } from '../error'
import { LogLevel, LoggerFunction, LoggingConfig } from '../types'

const ERROR: 'error' = 'error'
const WARN: 'warn' = 'warn'
const INFO: 'info' = 'info'
const DEBUG: 'debug' = 'debug'

const DEFAULT_LEVEL = INFO

const levels = {
  [ERROR]: 0,
  [WARN]: 1,
  [INFO]: 2,
  [DEBUG]: 3
}

/**
 * Logger used by the driver to notify about various internal events. Single logger should be used per driver.
 */
export class Logger {
  private readonly _level: LogLevel
  private readonly _loggerFunction: LoggerFunction
  /**
   * @constructor
   * @param {string} level the enabled logging level.
   * @param {function(level: string, message: string)} loggerFunction the function to write the log level and message.
   */
  constructor (level: LogLevel, loggerFunction: LoggerFunction) {
    this._level = level
    this._loggerFunction = loggerFunction
  }

  /**
   * Create a new logger based on the given driver configuration.
   * @param {Object} driverConfig the driver configuration as supplied by the user.
   * @return {Logger} a new logger instance or a no-op logger when not configured.
   */
  static create (driverConfig: { logging?: LoggingConfig }): Logger {
    if (driverConfig?.logging != null) {
      const loggingConfig = driverConfig.logging
      const level = extractConfiguredLevel(loggingConfig)
      const loggerFunction = extractConfiguredLogger(loggingConfig)
      return new Logger(level, loggerFunction)
    }
    return this.noOp()
  }

  /**
   * Create a no-op logger implementation.
   * @return {Logger} the no-op logger implementation.
   */
  static noOp (): Logger {
    return noOpLogger
  }

  /**
   * Check if error logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isErrorEnabled (): boolean {
    return isLevelEnabled(this._level, ERROR)
  }

  /**
   * Log an error message.
   * @param {string} message the message to log.
   */
  error (message: string): void {
    if (this.isErrorEnabled()) {
      this._loggerFunction(ERROR, message)
    }
  }

  /**
   * Check if warn logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isWarnEnabled (): boolean {
    return isLevelEnabled(this._level, WARN)
  }

  /**
   * Log an warning message.
   * @param {string} message the message to log.
   */
  warn (message: string): void {
    if (this.isWarnEnabled()) {
      this._loggerFunction(WARN, message)
    }
  }

  /**
   * Check if info logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isInfoEnabled (): boolean {
    return isLevelEnabled(this._level, INFO)
  }

  /**
   * Log an info message.
   * @param {string} message the message to log.
   */
  info (message: string): void {
    if (this.isInfoEnabled()) {
      this._loggerFunction(INFO, message)
    }
  }

  /**
   * Check if debug logging is enabled, i.e. it is not a no-op implementation.
   * @return {boolean} `true` when enabled, `false` otherwise.
   */
  isDebugEnabled (): boolean {
    return isLevelEnabled(this._level, DEBUG)
  }

  /**
   * Log a debug message.
   * @param {string} message the message to log.
   */
  debug (message: string): void {
    if (this.isDebugEnabled()) {
      this._loggerFunction(DEBUG, message)
    }
  }
}

class NoOpLogger extends Logger {
  constructor () {
    super(INFO, (level: LogLevel, message: string) => {})
  }

  isErrorEnabled (): boolean {
    return false
  }

  error (message: string): void {}

  isWarnEnabled (): boolean {
    return false
  }

  warn (message: string): void {}

  isInfoEnabled (): boolean {
    return false
  }

  info (message: string): void {}

  isDebugEnabled (): boolean {
    return false
  }

  debug (message: string): void {}
}

const noOpLogger = new NoOpLogger()

/**
 * Check if the given logging level is enabled.
 * @param {string} configuredLevel the configured level.
 * @param {string} targetLevel the level to check.
 * @return {boolean} value of `true` when enabled, `false` otherwise.
 */
function isLevelEnabled (configuredLevel: LogLevel, targetLevel: LogLevel): boolean {
  return levels[configuredLevel] >= levels[targetLevel]
}

/**
 * Extract the configured logging level from the driver's logging configuration.
 * @param {Object} loggingConfig the logging configuration.
 * @return {string} the configured log level or default when none configured.
 */
function extractConfiguredLevel (loggingConfig: LoggingConfig): LogLevel {
  if (loggingConfig?.level != null) {
    const configuredLevel = loggingConfig.level
    const value = levels[configuredLevel]
    if (value == null && value !== 0) {
      throw newError(
        `Illegal logging level: ${configuredLevel}. Supported levels are: ${Object.keys(
          levels
        ).toString()}`
      )
    }
    return configuredLevel
  }
  return DEFAULT_LEVEL
}

/**
 * Extract the configured logger function from the driver's logging configuration.
 * @param {Object} loggingConfig the logging configuration.
 * @return {function(level: string, message: string)} the configured logging function.
 */
function extractConfiguredLogger (loggingConfig: LoggingConfig): LoggerFunction {
  if (loggingConfig?.logger != null) {
    const configuredLogger = loggingConfig.logger
    if (configuredLogger != null && typeof configuredLogger === 'function') {
      return configuredLogger
    }
  }
  throw newError(`Illegal logger function: ${loggingConfig?.logger?.toString() ?? 'undefined'}`)
}
