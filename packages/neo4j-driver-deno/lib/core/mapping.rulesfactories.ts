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

import { Rule, valueAs } from './mapping.highlevel.ts'


import {  StandardDate, isNode, isPath, isRelationship, isUnboundRelationship } from './graph-types.ts'
import { isPoint } from './spatial-types.ts'
import { Date, DateTime, Duration, LocalDateTime, LocalTime, Time, isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from './temporal-types.ts'


export const RulesFactories = Object.freeze({
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
    asNumber (rule?: Rule & { acceptBigInt?: boolean }) {
        return {
            validate: (value: any, field: string) => {
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
    asBigInt (rule?: Rule & { acceptNumber?: boolean }) {
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
    asNode (rule?: Rule) {
        return {
            validate: (value: any, field: string) => {
                if (!isNode(value)) {
                    throw new TypeError(`${field} should be a Node but received ${typeof value}`)
                }
            },
            ...rule
        }
    },
    asRelationship (rule?: Rule) {
        return {
            validate: (value: any, field: string) => {
                if (!isRelationship(value)) {
                    throw new TypeError(`${field} should be a Relationship but received ${typeof value}`)
                }
            },
            ...rule
        }
    },
    asUnboundRelationship (rule?: Rule) {
        return {
            validate: (value: any, field: string) => {
                if (!isUnboundRelationship(value)) {
                    throw new TypeError(`${field} should be a UnboundRelationship but received ${typeof value}`)
                }
            },
            ...rule
        }
    },
    asPath (rule?: Rule) {
        return {
            validate: (value: any, field: string) => {
                if (!isPath(value)) {
                    throw new TypeError(`${field} should be a Path but received ${typeof value}`)
                }
            },
            ...rule
        }
    },
    asPoint (rule?: Rule) {
        return {
            validate: (value: any, field: string) => {
                if (!isPoint(value)) {
                    throw new TypeError(`${field} should be a Point but received ${typeof value}`)
                }
            },
            ...rule
        }
    },
    asDuration (rule?: Rule & { toString?: boolean }) {
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
    asLocalTime (rule?: Rule & { toString?: boolean }) {
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
    asTime (rule?: Rule & { toString?: boolean }) {
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
    asDate (rule?: Rule & { toString?: boolean, toStandardDate?: boolean }) {
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
    asLocalDateTime (rule?: Rule & { toString?: boolean, toStandardDate?: boolean }) {
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
    asDateTime (rule?: Rule & { toString?: boolean, toStandardDate?: boolean }) {
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
    asList (rule?: Rule & { apply?: Rule }) {
        return {
            validate: (value: any, field: string) => {
                if (!Array.isArray(value)) {
                    throw new TypeError(`${field} should be a string but received ${typeof value}`)
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

type ConvertableToStdDateOrStr = { toStandardDate: () => StandardDate, toString: () => string }

function convertStdDate<V extends ConvertableToStdDateOrStr>(value: V, rule?: { toString?: boolean, toStandardDate?: boolean }):string | V | StandardDate {
    if (rule != null) {
        if (rule.toString === true) {
            return value.toString()
        } else if (rule.toStandardDate === true) {
            return value.toStandardDate()
        }
    }
    return value
}
