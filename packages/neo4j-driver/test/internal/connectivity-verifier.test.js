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

import SingleConnectionProvider from '../../../bolt-connection/lib/connection-provider/connection-provider-single'
import FakeConnection from './fake-connection'
import { internal } from 'neo4j-driver-core'

const {
  connectivityVerifier: { ConnectivityVerifier }
} = internal

describe('#unit ConnectivityVerifier', () => {
  it('should call success callback when able to acquire and release a connection', done => {
    const connectionPromise = Promise.resolve(new FakeConnection())
    const connectionProvider = new SingleConnectionProvider(connectionPromise)
    const verifier = new ConnectivityVerifier(connectionProvider)

    verifier.verify().then(() => {
      done()
    })
  })
})
