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

import { Rule, valueAs, optionalParameterConversion, Rules, defaultNameMapping } from './mapping.highlevel.ts'
import { JSDate, StandardDate, isNode, isPath, isRelationship, isUnboundRelationship } from './graph-types.ts'
import { isPoint } from './spatial-types.ts'
import { Date, DateTime, Duration, LocalDateTime, LocalTime, Time, isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from './temporal-types.ts'
import Vector, { vector } from './vector.ts'
import { newError } from './error.ts'

/**
 * @property {function(rule: ?Rule)} asString Create a {@link Rule} that validates the value is a String.
 *
 * @property {function(rule: ?Rule & { acceptBigInt?: boolean })} asNumber Create a {@link Rule} that validates the value is a Number.
 *
 * @property {function(rule: ?Rule & { acceptNumber?: boolean })} AsBigInt Create a {@link Rule} that validates the value is a BigInt.
 *
 * @property {function(rule: ?Rule)} asNode Create a {@link Rule} that validates the value is a {@link Node}.
 *
 * @property {function(rule: ?Rule)} asRelationship Create a {@link Rule} that validates the value is a {@link Relationship}.
 *
 * @property {function(rule: ?Rule)} asPath Create a {@link Rule} that validates the value is a {@link Path}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean })} asDuration Create a {@link Rule} that validates the value is a {@link Duration}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean })} asLocalTime Create a {@link Rule} that validates the value is a {@link LocalTime}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean, JSNativeDate?: boolean })} asLocalDateTime Create a {@link Rule} that validates the value is a {@link LocalDateTime}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean })} asTime Create a {@link Rule} that validates the value is a {@link Time}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean, JSNativeDate?: boolean})} asDateTime Create a {@link Rule} that validates the value is a {@link DateTime}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean, JSNativeDate?: boolean})} asDate Create a {@link Rule} that validates the value is a {@link Date}.
 *
 * @property {function(rule: ?Rule)} asPoint Create a {@link Rule} that validates the value is a {@link Point}.
 *
 * @property {function(rule: ?Rule & { apply?: Rule })} asList Create a {@link Rule} that validates the value is a List.
 *
 * @property {function(rule: ?Rule & { asTypedList: boolean })} asVector Create a {@link Rule} that validates the value is a List.
 *
 */
export const rule = Object.freeze({
  /**
   * Create a {@link Rule} that validates the value is a Boolean.
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asBoolean (rule?: Rule): Rule {
    return {
      validate: (value, field) => {
        if (typeof value !== 'boolean') {
          throw new TypeError(`${field} should be a boolean but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a String.
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asString (rule?: Rule): Rule {
    return {
      validate: (value, field) => {
        if (typeof value !== 'string') {
          throw new TypeError(`${field} should be a string but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Number}.
   *
   * @param {Rule & { acceptBigInt?: boolean }} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asNumber (rule?: Rule & { acceptBigInt?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (typeof value === 'object' && value.low !== undefined && value.high !== undefined && Object.keys(value).length === 2) {
          throw new TypeError('Number returned as Object. To use asNumber mapping, set disableLosslessIntegers or useBigInt in driver config object')
        }
        if (typeof value !== 'number' && (rule?.acceptBigInt !== true || typeof value !== 'bigint')) {
          throw new TypeError(`${field} should be a number but received ${typeof value}`)
        }
      },
      convert: (value: number | bigint) => {
        if (typeof value === 'bigint') {
          return Number(value)
        }
        return value
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link BigInt}.
   *
   * @param {Rule & { acceptNumber?: boolean }} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asBigInt (rule?: Rule & { acceptNumber?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (typeof value !== 'bigint' && (rule?.acceptNumber !== true || typeof value !== 'number')) {
          throw new TypeError(`${field} should be a bigint but received ${typeof value}`)
        }
      },
      convert: (value: number | bigint) => {
        if (typeof value === 'number') {
          return BigInt(value)
        }
        return value
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Node}.
   *
   * @example
   * const actingJobsRules: Rules = {
   *  // Converts the person node to a Person object in accordance with provided rules
   *  person: neo4j.rule.asNode({
   *    convert: (node: Node) => node.as(Person, personRules)
   *  }),
   *  // Returns the movie node as a Node
   *  movie: neo4j.rule.asNode({}),
   * }
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asNode (rule?: Rule): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isNode(value)) {
          throw new TypeError(`${field} should be a Node but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Relationship}.
   *
   * @param {Rule} rule Configurations for the rule.
   * @returns {Rule} A new rule for the value
   */
  asRelationship (rule?: Rule): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isRelationship(value)) {
          throw new TypeError(`${field} should be a Relationship but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is an {@link UnboundRelationship}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asUnboundRelationship (rule?: Rule): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isUnboundRelationship(value)) {
          throw new TypeError(`${field} should be a UnboundRelationship but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Path}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asPath (rule?: Rule): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isPath(value)) {
          throw new TypeError(`${field} should be a Path but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Point}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asPoint (rule?: Rule): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isPoint(value)) {
          throw new TypeError(`${field} should be a Point but received ${typeof value}`)
        }
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Duration}
   *
   * @param {Rule} rule Configurations for the rule. Setting stringify will automatically convert between strings in user code and Durations in the database.
   * @returns {Rule} A new rule for the value
   */
  asDuration (rule?: Rule & { stringify?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isDuration(value)) {
          throw new TypeError(`${field} should be a Duration but received ${typeof value}`)
        }
      },
      convert: (value: Duration) => rule?.stringify === true ? value.toString() : value,
      parameterConversion: rule?.stringify === true ? (str: string) => Duration.fromString(str) : undefined,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link LocalTime}
   *
   * @param {Rule} rule Configurations for the rule. Setting stringify will automatically convert between strings in user code and LocalTimes in the database.
   * @returns {Rule} A new rule for the value
   */
  asLocalTime (rule?: Rule & { stringify?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isLocalTime(value)) {
          throw new TypeError(`${field} should be a LocalTime but received ${typeof value}`)
        }
      },
      convert: (value: LocalTime) => rule?.stringify === true ? value.toString() : value,
      parameterConversion: rule?.stringify === true ? (str: string) => LocalTime.fromString(str) : undefined,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Time}
   *
   * @param {Rule} rule Configurations for the rule. Setting stringify will automatically convert between strings in user code and Times in the database.
   * @returns {Rule} A new rule for the value
   */
  asTime (rule?: Rule & { stringify?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isTime(value)) {
          throw new TypeError(`${field} should be a Time but received ${typeof value}`)
        }
      },
      convert: (value: Time) => rule?.stringify === true ? value.toString() : value,
      parameterConversion: rule?.stringify === true ? (str: string) => Time.fromString(str) : undefined,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Date}
   *
   * @param {Rule} rule Configurations for the rule. Setting stringify/JSNativeDate will automatically convert between strings/JavaScript Dates in user code and Dates in the database.
   * @returns {Rule} A new rule for the value
   */
  asDate (rule?: Rule & { stringify?: boolean, JSNativeDate?: boolean }): Rule {
    if(rule?.stringify === true && rule?.JSNativeDate === true ) {
      throw newError("both stringify and JSNativeDate cannot be set; use one or neither")
    }
    let parameterConversion
    if (rule?.stringify === true) {
      parameterConversion = (str: string) => Date.fromStandardDateLocal(new JSDate(str))
    }
    if (rule?.JSNativeDate === true) {
      parameterConversion = (standardDate: StandardDate) => Date.fromStandardDateLocal(standardDate)
    }
    return {
      validate: (value: any, field: string) => {
        if (!isDate(value)) {
          throw new TypeError(`${field} should be a Date but received ${typeof value}`)
        }
      },
      convert: (value: Date) => convertStdDate(value, rule),
      parameterConversion,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link LocalDateTime}
   *
   * @param {Rule} rule Configurations for the rule. Setting stringify/JSNativeDate will automatically convert between strings/JavaScript Dates in user code and LocalDateTimes in the database.
   * @returns {Rule} A new rule for the value
   */
  asLocalDateTime (rule?: Rule & { stringify?: boolean, JSNativeDate?: boolean }): Rule {
    if(rule?.stringify === true && rule?.JSNativeDate === true ) {
      throw newError("both stringify and JSNativeDate cannot be set; use one or neither")
    }
    let parameterConversion
    if (rule?.stringify === true) {
      parameterConversion = (str: string) => LocalDateTime.fromString(str)
    }
    if (rule?.JSNativeDate === true) {
      parameterConversion = (standardDate: StandardDate) => LocalDateTime.fromStandardDate(standardDate)
    }
    return {
      validate: (value: any, field: string) => {
        if (!isLocalDateTime(value)) {
          throw new TypeError(`${field} should be a LocalDateTime but received ${typeof value}`)
        }
      },
      convert: (value: LocalDateTime) => convertStdDate(value, rule),
      parameterConversion,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link DateTime}
   *
   * @param {Rule} rule Configurations for the rule. Setting stringify/JSNativeDate will automatically convert between strings/JavaScript Dates in user code and DateTimes in the database.
   * @returns {Rule} A new rule for the value
   */
  asDateTime (rule?: Rule & { stringify?: boolean, JSNativeDate?: boolean }): Rule {
    if(rule?.stringify === true  && rule?.JSNativeDate === true ) {
      throw newError("both stringify and JSNativeDate cannot be set; use one or neither")
    }
    let parameterConversion
    if (rule?.stringify === true) {
      parameterConversion = (str: string) => DateTime.fromString(str)
    }
    if (rule?.JSNativeDate === true) {
      parameterConversion = (standardDate: StandardDate) => DateTime.fromStandardDate(standardDate)
    }
    return {
      validate: (value: any, field: string) => {
        if (!isDateTime(value)) {
          throw new TypeError(`${field} should be a DateTime but received ${typeof value}`)
        }
      },
      convert: (value: DateTime) => convertStdDate(value, rule),
      parameterConversion,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a List. Optionally taking a rule for hydrating the contained values.
   *
   * @param {Rule & { apply?: Rule }} rule Configurations for the rule. Setting apply to a rule will apply that rule to all elements of the list.
   * @returns {Rule} A new rule for the value
   */
  asList (rule?: Rule & { apply?: Rule }): Rule {
    return {
      validate: (list: any, field: string) => {
        if (!Array.isArray(list)) {
          throw new TypeError(`${field} should be a list but received ${typeof list}`)
        }
        if (rule?.apply != null && rule.apply.validate != null) {
          // @ts-ignore
          list.forEach((value, index) => rule.apply.validate(value, `${field}[${index}]`))
        }
      },
      convert: (list: any[], field: string) => {
        if (rule?.apply != null) {
          return list.map((value, index) => valueAs(value, `${field}[${index}]`, rule.apply))
        }
        return list
      },
      parameterConversion: (list: any[]) => {
        let apply = rule?.apply
        if (apply != null) {
          return list.map((value) => optionalParameterConversion(value, apply))
        }
        return list
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a Vector.
   *
   * @param {Rule & { asTypedList?: boolean }} rule Configurations for the rule. Setting asTypedList will automatically convert between TypedList in user code and Vectors in the database.
   * @returns {Rule} A new rule for the value
   */
  asVector (rule?: Rule & { asTypedList?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!(value instanceof Vector)) {
          throw new TypeError(`${field} should be a vector but received ${typeof value}`)
        }
      },
      convert: (value: Vector<any>) => {
        if (rule?.asTypedList === true) {
          return value._typedArray
        }
        return value
      },
      parameterConversion: rule?.asTypedList === true ? (typedArray: Int16Array | Int32Array | BigInt64Array | Float32Array | Float64Array) => vector(typedArray) : undefined,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} for an object, allowing complex mapping of even nested results
   * 
   * NOTE: When using this rule, object identifiers will be mapped according to any name mapping set with neo4j.RecordObjectMapping.translateIdentifiers.
   *
   * @param {Rules} rules rules for the fields of the object.
   * @returns {Rule} A new rule for the value
   */
  asObject(rules: Rules): Rule {
    return {
      validate: (value: Record<string, Object>, field: string) => {
        for(const key in rules) {
          const mappedkey = rules[key].from != null ? rules[key].from : defaultNameMapping(key)
          if(value[mappedkey] == null && rules[key].optional === true) {
              continue
          }
          if(rules[key].validate != null) {
            rules[key].validate(value[mappedkey], `${field}[${key}]`)
          }
        }
      },
      convert: (value: Record<string, Object>, field: string) => {
        let convertedValue: Record<string, Object> = {}
        for(const key in rules) {
          const mappedkey = rules[key].from != null ? rules[key].from : defaultNameMapping(key)
          if(value[key] == null && rules[key].optional === true) {
              continue
          }
          if(rules[key].convert != null) {
            convertedValue[key] = rules[key].convert(value[mappedkey], `${field}[${mappedkey}]`)
          }
          else {
            convertedValue[key] = value[mappedkey]
          }
        }
        return convertedValue
      },
      parameterConversion: (value: Record<string, Object>) => {
        let convertedValue: Record<string, Object> = {}
        for(const key in rules) {
          const mappedkey = rules[key].from != null ? rules[key].from : defaultNameMapping(key)
          if(value[key] == null && rules[key].optional === true) {
              continue
          }
          if(rules[key].parameterConversion != null) {
            convertedValue[mappedkey] = rules[key].parameterConversion(value[key])
          }
          else {
            convertedValue[mappedkey] = value[key]
          }
        }
        return convertedValue
      },
      ...rule
    }
  }
})

interface ConvertableToStdDateOrStr { toStandardDate: () => StandardDate, toString: () => string }

function convertStdDate<V extends ConvertableToStdDateOrStr> (value: V, rule?: { stringify?: boolean, JSNativeDate?: boolean }): string | V | StandardDate {
  if (rule != null) {
    if (rule.stringify === true) {
      return value.toString()
    } else if (rule.JSNativeDate === true) {
      return value.toStandardDate()
    }
  }
  return value
}
