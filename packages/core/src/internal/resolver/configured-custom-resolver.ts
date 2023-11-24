/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
/* eslint-disable @typescript-eslint/promise-function-async */
import { ServerAddress } from '../server-address'

function resolveToSelf (address: ServerAddress): Promise<ServerAddress[]> {
  return Promise.resolve([address])
}

export default class ConfiguredCustomResolver {
  private readonly _resolverFunction: (address: string) => string

  constructor (resolverFunction: (address: string) => string) {
    this._resolverFunction = resolverFunction ?? resolveToSelf
  }

  resolve (seedRouter: ServerAddress): Promise<ServerAddress[]> {
    return new Promise(resolve =>
      resolve(this._resolverFunction(seedRouter.asHostPort()))
    ).then(resolved => {
      if (!Array.isArray(resolved)) {
        throw new TypeError(
          'Configured resolver function should either return an array of addresses or a Promise resolved with an array of addresses.' +
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Each address is '<host>:<port>'. Got: ${resolved}`
        )
      }
      return resolved.map(r => ServerAddress.fromUrl(r))
    })
  }
}
