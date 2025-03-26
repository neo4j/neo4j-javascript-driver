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

import { newError } from './error'
import { nameConventions } from './mapping.nameconventions'

/**
 * constructor function of any class
 */
export type GenericConstructor<T extends {}> = new (...args: any[]) => T

export interface Rule {
  optional?: boolean
  from?: string
  convert?: (recordValue: any, field: string) => any
  validate?: (recordValue: any, field: string) => void
}

export type Rules = Record<string, Rule>

let rulesRegistry: Record<string, Rules> = {}

let nameMapping: (name: string) => string = (name) => name

/**
 * Registers a set of {@link Rules} to be used by {@link hydrated} for the provided class when no other rules are specified. This registry exists in global memory, not the driver instance.
 *
 * @example
 * // The following code:
 * const summary = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'}, {
 *  resultTransformer: neo4j.resultTransformers.hydrated(Person, personClassRules)
 * })
 *
 * can instead be written:
 * neo4j.mapping.register(Person, personClassRules)
 *
 * const summary = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'}, {
 *  resultTransformer: neo4j.resultTransformers.hydrated(Person)
 * })
 *
 *
 * @param {GenericConstructor} constructor The constructor function of the class to set rules for
 * @param {Rules} rules The rules to set for the provided class
 */
export function register <T extends {} = Object> (constructor: GenericConstructor<T>, rules: Rules): void {
  rulesRegistry[constructor.toString()] = rules
}

/**
 * Clears all registered type mappings from the mapping registry.
 */
export function clearMappingRegistry (): void {
  rulesRegistry = {}
}

/**
 * Sets a default name translation from record keys to object properties.
 * If providing a function, provide a function that maps FROM your object properties names TO record key names.
 *
 * The function defaultNameTranslation can be used to provide a prewritten translation function between some common naming conventions.
 *
 * @example
 * //if the keys on records from the database are in ALLCAPS
 * mapping.translatePropertyNames((name) => name.toUpperCase())
 *
 * //if you utilize PacalCase in the database and camelCase in JavaScript code.
 * mapping.translatePropertyNames(mapping.defaultNameTranslation("PascalCase", "camelCase"))
 *
 * //if a type has one odd mapping you can override the translation with the rule
 * const personRules = {
 *  firstName: neo4j.RulesFactories.asString(),
 *  bornAt: neo4j.RulesFactories.asNumber({ acceptBigInt: true, optional: true })
 *  weird_name-property: neo4j.RulesFactories.asString({from: 'homeTown'})
 * }
 * //These rules can then be used by providing them to a hydratedResultsMapper
 * record.as<Person>(personRules)
 * //or by registering them to the mapping registry
 * mapping.register(Person, personRules)
 *
 * @param {function} translationFunction A function translating the names of your JS object property names to record key names
 */
export function translatePropertyNames (translationFunction: (name: string) => string): void {
  nameMapping = translationFunction
}

/**
 * Creates a translation frunction from record key names to object property names, for use with the {@link translatePropertyNames} function
 *
 * Recognized naming conventions are "camelCase", "PascalCase", "snake_case", "kebab-case", "SNAKE_CAPS"
 *
 * @param {string} databaseConvention The naming convention in use in database result Records
 * @param {string} codeConvention The naming convention in use in JavaScript object properties
 * @returns {function} translation function
 */
export function defaultNameTranslation (databaseConvention: string, codeConvention: string): ((name: string) => string) {
  const keys = Object.keys(nameConventions)
  if (!keys.includes(databaseConvention)) {
    throw newError(
      `Naming convention ${databaseConvention} is not recognized, 
      please provide a recognized name convention or manually provide a translation function.`
    )
  }
  if (!keys.includes(codeConvention)) {
    throw newError(
      `Naming convention ${codeConvention} is not recognized, 
      please provide a recognized name convention or manually provide a translation function.`
    )
  }
  // @ts-expect-error
  return (name: string) => nameConventions[databaseConvention].encode(nameConventions[codeConvention].tokenize(name))
}

export const mapping = {
  register,
  clearMappingRegistry,
  translatePropertyNames,
  defaultNameTranslation
}

interface Gettable { get: <V>(key: string) => V }

export function as <T extends {} = Object> (gettable: Gettable, constructorOrRules: GenericConstructor<T> | Rules, rules?: Rules): T {
  const GenericConstructor = typeof constructorOrRules === 'function' ? constructorOrRules : Object
  const theRules = getRules(constructorOrRules, rules)
  const vistedKeys: string[] = []

  const obj = new GenericConstructor()

  for (const [key, rule] of Object.entries(theRules ?? {})) {
    vistedKeys.push(key)
    _apply(gettable, obj, key, rule)
  }

  for (const key of Object.getOwnPropertyNames(obj)) {
    if (!vistedKeys.includes(key)) {
      _apply(gettable, obj, key, theRules?.[key])
    }
  }

  return obj as unknown as T
}

function _apply<T extends {}> (gettable: Gettable, obj: T, key: string, rule?: Rule): void {
  const mappedkey = nameMapping(key)
  const value = gettable.get(rule?.from ?? mappedkey)
  const field = `${obj.constructor.name}#${key}`
  const processedValue = valueAs(value, field, rule)
  // @ts-expect-error
  obj[key] = processedValue ?? obj[key]
}

export function valueAs (value: unknown, field: string, rule?: Rule): unknown {
  if (rule?.optional === true && value == null) {
    return value
  }

  if (typeof rule?.validate === 'function') {
    rule.validate(value, field)
  }

  return ((rule?.convert) != null) ? rule.convert(value, field) : value
}
function getRules<T extends {} = Object> (constructorOrRules: Rules | GenericConstructor<T>, rules: Rules | undefined): Rules | undefined {
  const rulesDefined = typeof constructorOrRules === 'object' ? constructorOrRules : rules
  if (rulesDefined != null) {
    return rulesDefined
  }

  return typeof constructorOrRules !== 'object' ? rulesRegistry[constructorOrRules.toString()] : undefined
}
