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

import { structure } from '../packstream/index.js'
import { internal, isDate, isDateTime, isDuration, isInt, isLocalDateTime, isLocalTime, isPoint, isTime } from '../../core/index.ts'

const { objectUtil } = internal

/**
 * Class responsible for applying the expected {@link TypeTransformer} to
 * transform the driver types from and to {@link struct.Structure}
 */
export default class Transformer {
  /**
   * Constructor
   * @param {TypeTransformer[]} transformers The type transformers
   * @param {HydatrationHooks} hydration The hydration hooks
   * @param {DehydrationHooks} dehydrationHooks the DehydrationHooks
   */
  constructor (transformers, hydration, dehydrationHooks) {
    this._transformers = transformers
    hydration = hydration || {}
    this._hydrators = [
      [isDuration, hydration.Duration],
      [isLocalTime, hydration.LocalTime],
      [isLocalDateTime, hydration.LocalDateTime],
      [isTime, hydration.Time],
      [isDate, hydration.Date],
      [isDateTime, hydration.DateTime],
      [isInt, hydration.Integer],
      [isPoint, hydration.Point]
    ]
      .map(([isTypeInstance, hydrate]) => ({ isTypeInstance, hydrate }))
      .filter(({ hydrate }) => hydrate != null)

    this._dehydrationHooks = dehydrationHooks || []
    this._transformersPerSignature = new Map(transformers.map(typeTransformer => [typeTransformer.signature, typeTransformer]))
    this.fromStructure = this.fromStructure.bind(this)
    this.toStructure = this.toStructure.bind(this)
    Object.freeze(this)
  }

  /**
   * Transform from structure to specific object
   *
   * @param {struct.Structure} struct The structure
   * @returns {<T>|structure.Structure} The driver object or the structure if the transformer was not found.
   */
  fromStructure (struct) {
    try {
      const value = this._fromStructure(struct)
      const hydrator = this._hydrators.find(({ isTypeInstance }) => isTypeInstance(value))
      if (hydrator != null) {
        return hydrator.hydrate(value)
      }
      return value
    } catch (error) {
      return objectUtil.createBrokenObject(error)
    }
  }

  _fromStructure (struct) {
    if (struct instanceof structure.Structure && this._transformersPerSignature.has(struct.signature)) {
      const { fromStructure } = this._transformersPerSignature.get(struct.signature)
      return fromStructure(struct)
    }
    return struct
  }

  /**
   * Transform from object to structure
   * @param {<T>} type The object to be transoformed in structure
   * @returns {<T>|structure.Structure} The structure or the object, if any transformer was found
   */
  toStructure (type) {
    const dehydratedType = this._dehydrateType(type)
    const transformer = this._transformers.find(({ isTypeInstance }) => isTypeInstance(dehydratedType))
    if (transformer !== undefined) {
      return transformer.toStructure(dehydratedType)
    }
    return dehydratedType
  }

  _dehydrateType (type) {
    const dehydation = this._dehydrationHooks.find(({ isTypeInstance }) => isTypeInstance(type))
    if (dehydation !== undefined) {
      return dehydation.dehydrate(type)
    }
    return type
  }
}

/**
 * @callback isTypeInstanceFunction
 * @param {any} object The object
 * @return {boolean} is instance of
 */

/**
 * @callback toStructureFunction
 * @param {any} object The object
 * @return {structure.Structure} The structure
 */

/**
 * @callback fromStructureFunction
 * @param {structure.Structure} struct The structure
 * @return {any} The object
 */

/**
 * Class responsible for grouping the properties of a TypeTransformer
 */
export class TypeTransformer {
  /**
   * @param {Object} param
   * @param {number} param.signature The signature of the structure
   * @param {isTypeInstanceFunction} param.isTypeInstance The function which checks if object is
   *                instance of the type described by the TypeTransformer
   * @param {toStructureFunction} param.toStructure The function which gets the object and converts to structure
   * @param {fromStructureFunction} param.fromStructure The function which get the structure and covnverts to object
   */
  constructor ({ signature, fromStructure, toStructure, isTypeInstance }) {
    this.signature = signature
    this.isTypeInstance = isTypeInstance
    this.fromStructure = fromStructure
    this.toStructure = toStructure

    Object.freeze(this)
  }

  /**
   * @param {Object} param
   * @param {number} [param.signature] The signature of the structure
   * @param {isTypeInstanceFunction} [param.isTypeInstance] The function which checks if object is
   *                instance of the type described by the TypeTransformer
   * @param {toStructureFunction} [param.toStructure] The function which gets the object and converts to structure
   * @param {fromStructureFunction} pparam.fromStructure] The function which get the structure and covnverts to object
   * @returns {TypeTransformer} A new type transform extends with new methods
   */
  extendsWith ({ signature, fromStructure, toStructure, isTypeInstance }) {
    return new TypeTransformer({
      signature: signature || this.signature,
      fromStructure: fromStructure || this.fromStructure,
      toStructure: toStructure || this.toStructure,
      isTypeInstance: isTypeInstance || this.isTypeInstance
    })
  }
}
