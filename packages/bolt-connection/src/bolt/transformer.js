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

import { structure } from '../packstream'

export default class Transformer {
  constructor (transformers) {
    this._transformers = transformers
    this._transformersPerSignature = new Map(transformers.map(typeTransformer => [typeTransformer.signature, typeTransformer]))
    this.fromStructure = this.fromStructure.bind(this)
    this.toStructure = this.toStructure.bind(this)
    Object.freeze(this)
  }

  fromStructure (struct) {
    if (struct instanceof structure.Structure && this._transformersPerSignature.has(struct.signature)) {
      const { fromStructure } = this._transformersPerSignature.get(struct.signature)
      return fromStructure(struct)
    }
    return struct
  }

  toStructure (type) {
    const transformer = this._transformers.find(({ isTypeInstance }) => isTypeInstance(type))
    if (transformer !== undefined) {
      return transformer.toStructure(type)
    }
    return type
  }
}

export class TypeTransformer {
  constructor ({ signature, fromStructure, toStructure, isTypeInstance }) {
    this.signature = signature
    this.isTypeInstance = isTypeInstance
    this.fromStructure = fromStructure
    this.toStructure = toStructure

    Object.freeze(this)
  }

  extendsWith ({ signature, fromStructure, toStructure, isTypeInstance }) {
    return new TypeTransformer({
      signature: signature || this.signature,
      fromStructure: fromStructure || this.fromStructure,
      toStructure: toStructure || this.toStructure,
      isTypeInstance: isTypeInstance || this.isTypeInstance
    })
  }
}
