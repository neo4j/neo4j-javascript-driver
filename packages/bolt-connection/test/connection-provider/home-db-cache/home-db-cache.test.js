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
import HomeDBCache from '../../../src/connection-provider/home-db-cache/home-db-cache'
// Test null auth and impersonation
describe('Home DB Cache', () => {
  it('should set a db name and return it within the cache timeout', async () => {
    const cache = new HomeDBCache({ maxHomeDatabaseDelay: 100000 })

    const impersonatedUser = { username: 'name' }
    const auth = { token: 'token' }
    const dbName = 'testDb'

    cache.set({ impersonatedUser: impersonatedUser, auth: auth, databaseName: dbName })
    const returnedDbName = cache.get({ impersonatedUser: impersonatedUser, auth: auth })

    expect(dbName).toEqual(returnedDbName)
  })

  it('should return nothing if no entry for auth exists', async () => {
    const cache = new HomeDBCache({ maxHomeDatabaseDelay: 100000 })
    const auth = { token: 'token' }

    const returnedDbName = cache.get({ impersonatedUser: null, auth: auth })

    expect(returnedDbName).toEqual(null)
  })

  it('should return the correct dbName for user with no impersonation', async () => {
    const cache = new HomeDBCache({ maxHomeDatabaseDelay: 100000 })
    const auth1 = { token: 'auth1' }
    const auth2 = { token: 'auth2' }
    const dbName1 = 'testDb1'
    const dbName2 = 'testDb2'

    cache.set({ impersonatedUser: null, auth: auth1, databaseName: dbName1 })
    cache.set({ impersonatedUser: null, auth: auth2, databaseName: dbName2 })

    expect(cache.get({ auth: auth1 })).toEqual(dbName1)
    expect(cache.get({ auth: auth2 })).toEqual(dbName2)
  })

  it('should clear cache and nothing should then be returned from a get', async () => {
    const cache = new HomeDBCache({ maxHomeDatabaseDelay: 100000 })

    const impersonatedUser = { username: 'name' }
    const auth = { token: 'token' }
    const dbName = 'testDb'

    cache.set({ impersonatedUser: impersonatedUser, auth: auth, databaseName: dbName })
    cache.clearCache()
    const returnedDbName = cache.get({ impersonatedUser: impersonatedUser, auth: auth })

    expect(returnedDbName).toEqual(null)
  })

  it('should return null after cache delay has passed', done => {
    const cache = new HomeDBCache({ maxHomeDatabaseDelay: 1 })

    const impersonatedUser = { username: 'name' }
    const auth = { token: 'token' }
    const dbName = 'testDb'

    cache.set({ impersonatedUser: impersonatedUser, auth: auth, databaseName: dbName })
    const returnedDbName = cache.get({ impersonatedUser: impersonatedUser, auth: auth })
    expect(returnedDbName).toEqual(dbName)

    setTimeout(() => {
      const returnedDbName = cache.get({ impersonatedUser: impersonatedUser, auth: auth })
      expect(returnedDbName).toEqual(null)
      done()
    }, 5)
  })

  it('should return correct db for correct users', () => {
    const cache = new HomeDBCache({ maxHomeDatabaseDelay: 100000 })

    const impersonatedUser = { username: 'name' }
    const auth = { token: 'token' }
    const dbName = 'testDb'

    cache.set({ impersonatedUser: impersonatedUser, auth: auth, databaseName: dbName })
    const returnedDbName = cache.get({ impersonatedUser: impersonatedUser, auth: auth })
    expect(returnedDbName).toEqual(dbName)

    const impersonatedUser2 = { username: 'name' }
    const dbName2 = 'testDb'

    cache.set({ impersonatedUser: impersonatedUser2, auth: auth, databaseName: dbName2 })
    const returnedDbName2 = cache.get({ impersonatedUser: impersonatedUser2, auth: auth })
    expect(returnedDbName2).toEqual(dbName2)
  })
})
