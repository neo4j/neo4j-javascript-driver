import { Rule, rulesRegistry } from './mapping.highlevel'
import { rule } from './mapping.rulesfactories'

/**
 * Class Decorator Factory that enables the Neo4j Driver to map result records to this class
 *
 * @returns {Function} Class Decorator
 */
function mappedClass () {
  return (_: any, context: any) => {
    rulesRegistry[context.name] = context.metadata
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a boolean.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function booleanProperty (config?: Rule) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asBoolean(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a string.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function stringProperty (config?: Rule) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asString(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a number.
 *
 * @param {Rule & { isInteger?: boolean }} config Configurations for the rule.
 * If `isInteger` is set to true, the created validate function will allow Integer values through, and the conversion functions will ensure results are return as numbers while parameters are transmitted as integers.
 * @returns {Function} Property Decorator
 */
function numberProperty (config?: Rule & { isInteger?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asNumber(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a BigInt.
 *
 * @param {Rule & { acceptNumber?: boolean }} config Configurations for the rule, if `acceptNumber` is set to true, the created validate function will allow Numbers through and the convert function will turn Numbers into BigInts.
 * @returns {Function} Property Decorator
 */
function bigIntProperty (config?: Rule & { acceptNumber?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asBigInt(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to an Integer.
 *
 * @param {Rule & { acceptNumber?: boolean }} config Configurations for the rule, if `acceptNumber` is set to true, the created validate function will allow Numbers through and the convert function will turn Numbers into BigInts.
 * @returns {Function} Property Decorator
 */
function integerProperty (config?: Rule & { acceptNumber?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asInteger(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Node.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function nodeProperty (config?: Rule) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asNode(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Relationship.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function relationshipProperty (config?: Rule) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asRelationship(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Path.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function pathProperty (config?: Rule) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asPath(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Point.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function pointProperty (config?: Rule) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asPoint(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Duration.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function durationProperty (config?: Rule & { stringify?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asDuration(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a LocalTime
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 */
function localTimeProperty (config?: Rule & { stringify?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asLocalTime(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Time
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 */
function timeProperty (config?: Rule & { stringify?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asTime(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Date
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 */
function dateProperty (config?: Rule & { stringify?: boolean, jsNativeDate?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asDate(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a LocalDateTIme
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 */
function localDateTimeProperty (config?: Rule & { stringify?: boolean, jsNativeDate?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asLocalDateTime(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a DateTIme
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 */
function dateTimeProperty (config?: Rule & { stringify?: boolean, jsNativeDate?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asDateTime(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a List
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 */
function listProperty (config?: Rule & { apply?: Rule }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asList({ apply: { ...context.metadata[context.name] }, ...config })
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Vector
 *
 * @param {Rule & { asTypedList?: boolean, dimension?: number, type?: "INT8" | "INT16" | "INT32" | "INT64" | "FLOAT32" | "FLOAT64"; }} config
 * @returns {Function} Property Decorator
 */
function vectorProperty (config?: Rule & { asTypedList?: boolean, dimension?: number, type?: 'INT8' | 'INT16' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64' }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asVector(config)
  }
}

/**
 * Property Decorator Factory that sets this property to optional.
 * NOTE: Should be put above a type decorator.
 *
 * @returns {Function} Property Decorator
 */
function optionalProperty () {
  return (_: any, context: any) => {
    context.metadata[context.name] = { optional: true, ...context.metadata[context.name] }
  }
}

/**
 * Property Decorator Factory that sets a custom parameter name to map this property to.
 * NOTE: Should be put above a type decorator.
 *
 * @param {string} name
 * @returns {Function} Property Decorator
 */
function mapPropertyFromName (name: string) {
  return (_: any, context: any) => {
    context.metadata[context.name] = { from: name, ...context.metadata[context.name] }
  }
}

/**
 * Property Decorator Factory that sets the Neo4j Driver to convert this property to another type.
 * NOTE: Should be put above a type decorator of type Node or Relationship.
 *
 * @param {any} type
 * @returns {Function} Property Decorator
 */
function convertPropertyToType (type: any) {
  return (_: any, context: any) => {
    context.metadata[context.name] = { convert: (node: any) => node.as(type), ...context.metadata[context.name] }
  }
}

const forExport = {
  booleanProperty,
  stringProperty,
  numberProperty,
  bigIntProperty,
  integerProperty,
  nodeProperty,
  relationshipProperty,
  pathProperty,
  pointProperty,
  durationProperty,
  localTimeProperty,
  timeProperty,
  dateProperty,
  localDateTimeProperty,
  dateTimeProperty,
  listProperty,
  vectorProperty,
  optionalProperty,
  mapPropertyFromName,
  convertPropertyToType,
  mappedClass
}

export default forExport
