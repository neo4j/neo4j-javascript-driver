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

import { nameConventions } from './mapping.nameconventions.ts'

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

const rulesRegistry: Record<string, Rules> = {}

let nameMapping: (name:string) => string = (name) => name

/**
 * Registers a set of {@link Rules} to be used by {@link hydratedResultTransformer} for the provided class when no other rules are specified. This registry exists in global memory, not the driver instance.
 *
 * @example
 * // The following code:
 * const summary = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'}, {
 *  resultTransformer: neo4j.resultTransformers.hydratedResultTransformer(Person, personClassRules)
 * })
 *
 * can instead be written:
 * neo4j.mapping.register(Person, personClassRules)
 *
 * const summary = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'}, {
 *  resultTransformer: neo4j.resultTransformers.hydratedResultTransformer(Person)
 * })
 *
 *
 * @param {GenericConstructor} constructor The constructor function of the class to set rules for
 * @param {Rules} rules The rules to set for the provided class
 */
export function register <T extends {} = Object> (constructor: GenericConstructor<T>, rules: Rules): void {
  rulesRegistry[constructor.toString()] = rules
}

export function translatePropertyNames(translationFunction: (name: string) => string): void {
  nameMapping = translationFunction
}

export function defaultNameTranslation(from: string, to: string): ((name: string) => string) {
  // @ts-expect-error
  return (name:string) => nameConventions[from].encode(nameConventions[to].tokenize(name))
}

export const mapping = {
  register,
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
