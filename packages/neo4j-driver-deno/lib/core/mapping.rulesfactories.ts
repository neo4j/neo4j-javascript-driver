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
import { StandardDate, isNode, isPath, isRelationship } from './graph-types.ts'
import { isPoint } from './spatial-types.ts'
import { Date, DateTime, Duration, LocalDateTime, LocalTime, Time, isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from './temporal-types.ts'
import Vector, { isVector, vector } from './vector.ts'
import { newError } from './error.ts'
import Integer, { isInt } from './integer.ts'

/**
 * @property {function(rule: ?Rule)} asBoolean Create a {@link Rule} that validates the value is a Boolean.
 *
 * @property {function(rule: ?Rule)} asString Create a {@link Rule} that validates the value is a String.
 *
 * @property {function(rule: ?Rule & { isInteger?: boolean })} asNumber Create a {@link Rule} that validates the value is a {@link Number}.
 *
 * @property {function(rule: ?Rule & { acceptNumber?: boolean })} asBigInt Create a {@link Rule} that validates the value is a {@link BigInt}.
 *
 * @property {function(rule: ?Rule & { acceptNumber?: boolean })} asInteger Create a {@link Rule} that validates the value is an {@link Integer}.
 *
 * @property {function(rule: ?Rule)} asNode Create a {@link Rule} that validates the value is a {@link Node}.
 *
 * @property {function(rule: ?Rule)} asRelationship Create a {@link Rule} that validates the value is a {@link Relationship}.
 *
 * @property {function(rule: ?Rule)} asUnboundRelationship Create a {@link Rule} that validates the value is an {@link UnboundRelationship}.
 *
 * @property {function(rule: ?Rule)} asPath Create a {@link Rule} that validates the value is a {@link Path}.
 *
 * @property {function(rule: ?Rule)} asPoint Create a {@link Rule} that validates the value is a {@link Point}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean })} asDuration Create a {@link Rule} that validates the value is a {@link Duration}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean })} asLocalTime Create a {@link Rule} that validates the value is a {@link LocalTime}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean })} asTime Create a {@link Rule} that validates the value is a {@link Time}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean, JSNativeDate?: boolean })} asDate Create a {@link Rule} that validates the value is a {@link Date}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean, JSNativeDate?: boolean })} asLocalDateTime Create a {@link Rule} that validates the value is a {@link LocalDateTime}.
 *
 * @property {function(rule: ?Rule & { stringify?: boolean, JSNativeDate?: boolean })} asDateTime Create a {@link Rule} that validates the value is a {@link DateTime}.
 *
 * @property {function(rule: ?Rule & { apply?: Rule })} asList Create a {@link Rule} that validates the value is a List.
 *
 * @property {function(rule: ?Rule & { asTypedList?: boolean, dimension?: number, type?: "INT8" | "INT16" | "INT32" | "INT64" | "FLOAT32" | "FLOAT64" })} asVector Create a {@link Rule} that validates the value is a Vector.
 *
 * @property {function(rules: Rules)} asObject Create a {@link Rule} for an object, allowing complex mapping of even nested results.
 */
export const rule = Object.freeze({
  /**
   * Create a {@link Rule} that validates the value is a Boolean.
   *
   * @param {Rule | undefined} rule Configurations for the rule
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
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @param {Rule | undefined} rule Configurations for the rule
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
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @param {Rule & { isInteger?: boolean } | undefined } rule Configurations for the rule.
   * If `isInteger` is set to true, the created validate function will allow Integer values through, and the conversion functions will ensure results are return as numbers while parameters are transmitted as integers.
   * @returns {Rule} A new rule for the value
   */
  asNumber (rule?: Rule & { isInteger?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (isInt(value) && rule?.isInteger !== true) {
          throw new TypeError('Number returned as Integer Object. To use asNumber mapping with Integers, set "isInteger" in rule configuration.')
        }
        if (rule?.isInteger !== true && typeof value === 'bigint') {
          throw new TypeError('Number returned as BigInt. To use asNumber mapping with integer values, set "isInteger" in rule configuration.')
        }
        if (typeof value !== 'number') {
          throw new TypeError(`${field} should be a number but received ${typeof value}`)
        }
      },
      convert: (value: number | bigint | Integer) => {
        if (typeof value === 'bigint') {
          return Number(value)
        }
        if (isInt(value)) {
          return value.toNumber()
        }
        return value
      },
      parameterConversion: (value: number | bigint | Integer) => {
        if (rule?.isInteger === true) {
          return Integer.fromValue(value)
        }
        return value
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link BigInt}.
   *
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @returns {Rule} A new rule for the value
   */
  asBigInt (rule?: Rule & { acceptNumber?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (
          typeof value !== 'bigint' && (rule?.acceptNumber !== true || typeof value !== 'number') && !isInt(value)
        ) {
          throw new TypeError(`${field} should be a bigint but received ${typeof value}`)
        }
      },
      convert: (value: number | bigint | Integer) => {
        if (typeof value === 'number') {
          return BigInt(value)
        }
        if (isInt(value)) {
          return value.toBigInt()
        }
        return value
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is an {@link Integer}.
   *
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @param {Rule & { acceptNumber?: boolean } | undefined} rule Configurations for the rule, if `acceptNumber` is set to true, the created validate function will allow Numbers through and the conversion functions will turn Numbers into Integers.
   * @returns {Rule} A new rule for the value
   */
  asInteger (rule?: Rule & { acceptNumber?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (typeof value !== 'bigint' && !isInt(value) && !(typeof value === 'number' && rule?.acceptNumber === true)) {
          throw new TypeError(`${field} should be an Integer but received ${typeof value}`)
        }
      },
      convert: (value: number | bigint | Integer) => {
        if (typeof value === 'bigint') {
          return Integer.fromValue(value)
        }
        return value
      },
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Node}.
   *
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
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
   * @param {Rule | undefined} rule Configurations for the rule
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
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @example
   * const actingJobsRules: Rules = {
   *  // Converts the role relationship to a Role object in accordance with provided rules
   *  role: neo4j.rule.asRelationship({
   *    convert: (rel: Relationship) => rel.as(Role, roleRules)
   *  }),
   *  // Returns the employment relationship as a Relationship
   *  employment: neo4j.rule.asRelationship({}),
   * }
   *
   * @param {Rule | undefined} rule Configurations for the rule.
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
   * Create a {@link Rule} that validates the value is a {@link Path}
   *
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @param {Rule | undefined} rule Configurations for the rule
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
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @param {Rule | undefined} rule Configurations for the rule
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
   * Optionally takes a {@link Rule}, in which case the returned rule will keep all fields of the one provided.
   *
   * @param {Rule & { stringify?: boolean } | undefined} rule Configurations for the rule. If `stringify` is set, the returned rule will have `convert` and `parameterConversion` functions which automatically convert between strings in user code and {@link Duration}s in the database.
   * @returns {Rule} A new rule for the value
   */
  asDuration (rule?: Rule & { stringify?: boolean }): Rule {
    if (rule?.stringify != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, stringify can not be used in combination with custom conversion functions.')
    }
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
   * @param {Rule & { stringify?: boolean } | undefined} rule Configurations for the rule. If `stringify` is set, the returned rule will have `convert` and `parameterConversion` functions which automatically convert between strings in user code and {@link LocalTime}s in the database.
   * @returns {Rule} A new rule for the value
   */
  asLocalTime (rule?: Rule & { stringify?: boolean }): Rule {
    if (rule?.stringify != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, stringify can not be used in combination with custom conversion functions.')
    }
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
   * @param {Rule & { stringify?: boolean } | undefined} rule Configurations for the rule. If `stringify` is set, the returned rule will have `convert` and `parameterConversion` functions which automatically convert between strings in user code and {@link Time}s in the database.
   * @returns {Rule} A new rule for the value
   */
  asTime (rule?: Rule & { stringify?: boolean }): Rule {
    if (rule?.stringify != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, stringify can not be used in combination with custom conversion functions.')
    }
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
   * @param {Rule & { stringify?: boolean, jsNativeDate?: boolean } | undefined} rule Configurations for the rule. If `stringify`/`jsNativeDate` is set, the returned rule will have `convert` and `parameterConversion` functions which automatically convert between strings/JavaScript Dates in user code and {@link Date}s in the database.
   * @returns {Rule} A new rule for the value
   */
  asDate (rule?: Rule & { stringify?: boolean, jsNativeDate?: boolean }): Rule {
    if (rule?.stringify != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, stringify can not be used in combination with custom conversion functions.')
    }
    if (rule?.jsNativeDate != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, jsNativeDate can not be used in combination with custom conversion functions.')
    }
    if (rule?.stringify === true && rule?.jsNativeDate === true) {
      throw newError('both stringify and jsNativeDate cannot be set; use one or neither')
    }
    let parameterConversion
    if (rule?.stringify === true) {
      parameterConversion = (str: string) => Date.fromString(str)
    }
    if (rule?.jsNativeDate === true) {
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
   * @param {Rule & { stringify?: boolean, jsNativeDate?: boolean } | undefined} rule Configurations for the rule. If `stringify`/`jsNativeDate` is set, the returned rule will have `convert` and `parameterConversion` functions which automatically convert between strings/JavaScript Dates in user code and {@link LocalDateTime}s in the database.
   * @returns {Rule} A new rule for the value
   */
  asLocalDateTime (rule?: Rule & { stringify?: boolean, jsNativeDate?: boolean }): Rule {
    if (rule?.stringify != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, stringify can not be used in combination with custom conversion functions.')
    }
    if (rule?.jsNativeDate != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, jsNativeDate can not be used in combination with custom conversion functions.')
    }
    if (rule?.stringify === true && rule?.jsNativeDate === true) {
      throw newError('both stringify and jsNativeDate cannot be set; use one or neither')
    }
    let parameterConversion
    if (rule?.stringify === true) {
      parameterConversion = (str: string) => LocalDateTime.fromString(str)
    }
    if (rule?.jsNativeDate === true) {
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
   * @param {Rule & { stringify?: boolean, jsNativeDate?: boolean } | undefined} rule Configurations for the rule. If `stringify`/`jsNativeDate` is set, the returned rule will have `convert` and `parameterConversion` functions which automatically convert between strings/JavaScript Dates in user code and {@link DateTime}s in the database.
   */
  asDateTime (rule?: Rule & { stringify?: boolean, jsNativeDate?: boolean }): Rule {
    if (rule?.stringify != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, stringify can not be used in combination with custom conversion functions.')
    }
    if (rule?.jsNativeDate != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, jsNativeDate can not be used in combination with custom conversion functions.')
    }
    if (rule?.stringify === true && rule?.jsNativeDate === true) {
      throw newError('both stringify and jsNativeDate cannot be set; use one or neither')
    }
    let parameterConversion
    if (rule?.stringify === true) {
      parameterConversion = (str: string) => DateTime.fromString(str)
    }
    if (rule?.jsNativeDate === true) {
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
   * Create a {@link Rule} that validates the value is a List.
   *
   * Optionally taking a rule for hydrating the contained values.
   *
   * @param {Rule & { apply?: Rule } | undefined} rule Configurations for the rule. Setting apply to a rule will apply that rule to all elements of the list.
   * @returns {Rule} A new rule for the value
   */
  asList (rule?: Rule & { apply?: Rule }): Rule {
    return {
      validate: (list: any, field: string) => {
        if (!Array.isArray(list)) {
          throw new TypeError(`${field} should be a list but received ${typeof list}`)
        }
        const validate = rule?.apply?.validate
        if (validate != null) {
          list.forEach((value, index) => validate(value, `${field}[${index}]`))
        }
      },
      convert: (list: any[], field: string) => {
        if (rule?.apply != null) {
          return list.map((value, index) => valueAs(value, `${field}[${index}]`, rule.apply))
        }
        return list
      },
      parameterConversion: (list: any[]) => {
        const apply = rule?.apply
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
   * @param {Rule & { asTypedList?: boolean, dimension?: number, type?: 'INT8' | 'INT16' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64' } | undefined} rule Configurations for the rule. Setting asTypedList will automatically convert between TypedList in user code and Vectors in the database.
   * @returns {Rule} A new rule for the value
   */
  asVector (rule?: Rule & { asTypedList?: boolean, dimension?: number, type?: 'INT8' | 'INT16' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64' }): Rule {
    if (rule?.asTypedList != null && (rule?.convert != null || rule.parameterConversion != null)) {
      throw newError('Provided rule already has convert and/or parameterConversion function, asTypedList can not be used in combination with custom conversion functions.')
    }
    return {
      validate: (value: any, field: string) => {
        if (!isVector(value)) {
          throw new TypeError(`${field} should be a vector but received ${typeof value}`)
        }
        if (rule?.dimension != null && value.asTypedArray().length !== rule.dimension) {
          throw new TypeError(`${field} should be a vector of length ${rule.dimension} but received length ${value.asTypedArray().length}`)
        }
        if (rule?.type != null && value.getType() !== rule.type) {
          throw new TypeError(`${field} should be a vector of type ${rule.type} but received type ${value.getType()}`)
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
  asObject (rules: Rules): Rule {
    return {
      validate: (value: Record<string, Object>, field: string) => {
        for (const key in rules) {
          const mappedKey = rules[key].from != null ? rules[key].from : defaultNameMapping(key)
          if (value[mappedKey] == null) {
            if (rules[key].optional === true) {
              continue
            } else {
              throw newError(
                `Mapped Parameter object did not include required field ${field} with key ${mappedKey}, 
                check provided parameters and parameter rules.`
              )
            }
          }
          if (rules[key].validate != null) {
            rules[key].validate(value[mappedKey], `${field}[${key}]`)
          }
        }
      },
      convert: (value: Record<string, Object>, field: string) => {
        const convertedValue: Record<string, Object> = {}
        for (const key in rules) {
          const mappedKey = rules[key].from != null ? rules[key].from : defaultNameMapping(key)
          if (value[mappedKey] != null && rules[key].convert != null) {
            convertedValue[key] = rules[key].convert(value[mappedKey], `${field}[${mappedKey}]`)
          } else {
            convertedValue[key] = value[mappedKey]
          }
        }
        return convertedValue
      },
      parameterConversion: (value: Record<string, Object>) => {
        const convertedValue: Record<string, Object> = {}
        for (const key in rules) {
          const mappedKey = rules[key].from != null ? rules[key].from : defaultNameMapping(key)
          if (value[key] != null && rules[key].parameterConversion != null) {
            convertedValue[mappedKey] = rules[key].parameterConversion(value[key])
          } else {
            convertedValue[mappedKey] = value[key]
          }
        }
        return convertedValue
      },
      ...rule
    }
  }
})

interface ConvertableToStdDateOrStr { toStandardDate: () => StandardDate, toString: () => string }

function convertStdDate<V extends ConvertableToStdDateOrStr> (value: V, rule?: { stringify?: boolean, jsNativeDate?: boolean }): string | V | StandardDate {
  if (rule != null) {
    if (rule.stringify === true) {
      return value.toString()
    } else if (rule.jsNativeDate === true) {
      return value.toStandardDate()
    }
  }
  return value
}
