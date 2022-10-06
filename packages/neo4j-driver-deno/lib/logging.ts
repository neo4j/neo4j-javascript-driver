import { types as coreTypes } from './core/index.ts'

type LogLevel = coreTypes.LogLevel

/**
 * Object containing predefined logging configurations. These are expected to be used as values of the driver config's `logging` property.
 * @property {function(level: ?string): object} console the function to create a logging config that prints all messages to `console.log` with
 * timestamp, level and message. It takes an optional `level` parameter which represents the maximum log level to be logged. Default value is 'info'.
 */
export const logging = {
  console: (level: LogLevel) => {
    return {
      level: level,
      logger: (level: LogLevel, message: string) =>
        console.log(`${Date.now()} ${level.toUpperCase()} ${message}`)
        // Note: This 'logging' object is in its own file so we can easily access the global Date object here without conflicting
        // with the Neo4j Date class, and without relying on 'globalThis' which isn't compatible with Node 10.
    }
  }
}
