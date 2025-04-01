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

import { Rule, valueAs } from './mapping.highlevel'
import { StandardDate, isNode, isPath, isRelationship, isUnboundRelationship } from './graph-types'
import { isPoint } from './spatial-types'
import { Date, DateTime, Duration, LocalDateTime, LocalTime, Time, isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from './temporal-types'

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
 * @property {function(rule: ?Rule & { toString?: boolean })} asDuration Create a {@link Rule} that validates the value is a {@link Duration}.
 *
 * @property {function(rule: ?Rule & { toString?: boolean })} asLocalTime Create a {@link Rule} that validates the value is a {@link LocalTime}.
 *
 * @property {function(rule: ?Rule & { toString?: boolean })} asLocalDateTime Create a {@link Rule} that validates the value is a {@link LocalDateTime}.
 *
 * @property {function(rule: ?Rule & { toString?: boolean })} asTime Create a {@link Rule} that validates the value is a {@link Time}.
 *
 * @property {function(rule: ?Rule & { toString?: boolean })} asDateTime Create a {@link Rule} that validates the value is a {@link DateTime}.
 *
 * @property {function(rule: ?Rule & { toString?: boolean })} asDate Create a {@link Rule} that validates the value is a {@link Date}.
 *
 * @property {function(rule: ?Rule)} asPoint Create a {@link Rule} that validates the value is a {@link Point}.
 *
 * @property {function(rule: ?Rule & { apply?: Rule })} asList Create a {@link Rule} that validates the value is a List.
 */
export const RulesFactories = Object.freeze({
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
   *  person: neo4j.RulesFactories.asNode({
   *    convert: (node: Node) => node.as(Person, personRules)
   *  }),
   *  // Returns the movie node as a Node
   *  movie: neo4j.RulesFactories.asNode({}),
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
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asDuration (rule?: Rule & { toString?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isDuration(value)) {
          throw new TypeError(`${field} should be a Duration but received ${typeof value}`)
        }
      },
      convert: (value: Duration) => rule?.toString === true ? value.toString() : value,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link LocalTime}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asLocalTime (rule?: Rule & { toString?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isLocalTime(value)) {
          throw new TypeError(`${field} should be a LocalTime but received ${typeof value}`)
        }
      },
      convert: (value: LocalTime) => rule?.toString === true ? value.toString() : value,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Time}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asTime (rule?: Rule & { toString?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isTime(value)) {
          throw new TypeError(`${field} should be a Time but received ${typeof value}`)
        }
      },
      convert: (value: Time) => rule?.toString === true ? value.toString() : value,
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link Date}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asDate (rule?: Rule & { toString?: boolean, toStandardDate?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isDate(value)) {
          throw new TypeError(`${field} should be a Date but received ${typeof value}`)
        }
      },
      convert: (value: Date) => convertStdDate(value, rule),
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link LocalDateTime}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asLocalDateTime (rule?: Rule & { toString?: boolean, toStandardDate?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isLocalDateTime(value)) {
          throw new TypeError(`${field} should be a LocalDateTime but received ${typeof value}`)
        }
      },
      convert: (value: LocalDateTime) => convertStdDate(value, rule),
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a {@link DateTime}
   *
   * @param {Rule} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asDateTime (rule?: Rule & { toString?: boolean, toStandardDate?: boolean }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!isDateTime(value)) {
          throw new TypeError(`${field} should be a DateTime but received ${typeof value}`)
        }
      },
      convert: (value: DateTime) => convertStdDate(value, rule),
      ...rule
    }
  },
  /**
   * Create a {@link Rule} that validates the value is a List. Optionally taking a rule for hydrating the contained values.
   *
   * @param {Rule & { apply?: Rule }} rule Configurations for the rule
   * @returns {Rule} A new rule for the value
   */
  asList (rule?: Rule & { apply?: Rule }): Rule {
    return {
      validate: (value: any, field: string) => {
        if (!Array.isArray(value)) {
          throw new TypeError(`${field} should be a list but received ${typeof value}`)
        }
      },
      convert: (list: any[], field: string) => {
        if (rule?.apply != null) {
          return list.map((value, index) => valueAs(value, `${field}[${index}]`, rule.apply))
        }
        return list
      },
      ...rule
    }
  }
})

interface ConvertableToStdDateOrStr { toStandardDate: () => StandardDate, toString: () => string }

function convertStdDate<V extends ConvertableToStdDateOrStr> (value: V, rule?: { toString?: boolean, toStandardDate?: boolean }): string | V | StandardDate {
  if (rule != null) {
    if (rule.toString === true) {
      return value.toString()
    } else if (rule.toStandardDate === true) {
      return value.toStandardDate()
    }
  }
  return value
}
