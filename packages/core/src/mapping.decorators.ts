import { Rule, rulesRegistry } from './mapping.highlevel'
import { rule } from './mapping.rulesfactories'

/**
 * Class Decorator Factory that enables the Neo4j Driver to map result records to this class
 *
 * @returns {Function} Class Decorator
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
 */
function durationProperty (config?: Rule & { stringify?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asDuration(config)
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a List
 *
 * @param {Rule & { apply?: Rule }} config
 * @returns {Function} Property Decorator
 * @experimental Part of the Record Object Mapping preview feature
 */
function listProperty (config?: Rule & { apply?: Rule }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asList({ apply: { ...context.metadata[context.name] }, ...config })
  }
}

/**
 * Property Decorator Factory that enables the Neo4j Driver to map this property to a Vector
 *
 * @param {Rule & { asTypedList?: boolean }} config
 * @returns {Function} Property Decorator
 * @experimental Part of the Record Object Mapping preview feature
 */
function vectorProperty (config?: Rule & { asTypedList?: boolean }) {
  return (_: any, context: any) => {
    context.metadata[context.name] = rule.asVector(config)
  }
}

/**
 * Property Decorator Factory that sets this property to optional.
 * NOTE: Should be put above a type decorator.
 *
 * @param {Rule} config
 * @returns {Function} Property Decorator
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
 * @experimental Part of the Record Object Mapping preview feature
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
  vectorProperty,
  optionalProperty,
  mapPropertyFromName,
  convertPropertyToType,
  mappedClass
}

export default forExport
