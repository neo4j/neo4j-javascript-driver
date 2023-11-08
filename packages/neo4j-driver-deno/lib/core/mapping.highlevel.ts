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
export type GenericConstructor<T extends {}> = new (...args: any[]) => T

export interface Rule {
    optional?: boolean,
    from?: string,
    convert?: (recordValue: any, field: string) => any
    validate?: (recordValue: any, field: string) => void 
}

export type Rules = Record<string, Rule>

type Gettable = { get<V>(key: string): V }


export function as <T extends {} = Object>(gettable: Gettable , constructorOrRules: GenericConstructor<T> | Rules, rules?: Rules): T {
    const GenericConstructor = typeof constructorOrRules === 'function' ? constructorOrRules : Object
    const theRules = typeof constructorOrRules === 'object' ? constructorOrRules : rules
    const vistedKeys: string[] = []

    const obj = new GenericConstructor

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


function _apply<T extends {}>(gettable: Gettable, obj: T, key: string, rule?: Rule): void {
    const value = gettable.get(rule?.from ?? key)
    const field = `${obj.constructor.name}#${key}`
    const processedValue = valueAs(value, field, rule)

    // @ts-ignore
    obj[key] = processedValue ?? obj[key]
}

export function valueAs (value: unknown, field: string, rule?: Rule): unknown {
    if (rule?.optional === true && value == null) {
        return value
    }
    
    if (typeof rule?.validate === 'function') {
        rule.validate(value, field)
    }

    return rule?.convert ? rule.convert(value, field) : value
}


