import { Rule, rulesRegistry } from './mapping.highlevel.ts'
import { rule } from './mapping.rulesfactories.ts'

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
 * @param {Rule & { acceptBigInt?: boolean }} config
 * @returns {Function} Property Decorator
 */
function numberProperty (config?: Rule & { acceptBigInt?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asNumber(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a BigInt.
 *
 * @param {Rule & { acceptNumber?: boolean }} config
 * @returns {Function} Property Decorator
 */
function bigIntProperty (config?: Rule & { acceptNumber?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asBigInt(config)
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
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a List
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 */
function listProperty (config?: Rule & { apply?: Rule }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asList({ apply: { ...context.metadata[context.name] }, ...config })
  }
}

/**
 * Property Decorator Factory that sets this property to optional.
 * NOTE: Should be put above a type decorator.
 *
 * @param {Rule} config
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
 * @param {Rule} config
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
 * @param {Rule} config
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
  nodeProperty,
  relationshipProperty,
  pathProperty,
  pointProperty,
  durationProperty,
  listProperty,
  optionalProperty,
  mapPropertyFromName,
  convertPropertyToType,
  mappedClass
}

export default forExport
