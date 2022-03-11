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
import RxManagedTransaction from '../../src/transaction-managed-rx'

describe('#unit', () => {
  describe('.commit()', () => {
    it('should delegate to the original Transaction', async () => {
      const txc = {
        commit: jasmine.createSpy('commit').and.returnValue(Promise.resolve())
      }

      const transaction = new RxManagedTransaction(txc)

      await transaction.commit().toPromise()

      expect(txc.commit).toHaveBeenCalled()
    })

    it('should fail if to the original Transaction.close call fails', async () => {
      const expectedError = new Error('expected')
      const txc = {
        commit: jasmine
          .createSpy('commit')
          .and.returnValue(Promise.reject(expectedError))
      }

      const transaction = new RxManagedTransaction(txc)

      try {
        await transaction.commit().toPromise()
        fail('should have thrown')
      } catch (error) {
        expect(error).toBe(expectedError)
      }
    })
  })

  describe('.rollback()', () => {
    it('should delegate to the original Transaction', async () => {
      const txc = {
        rollback: jasmine
          .createSpy('rollback')
          .and.returnValue(Promise.resolve())
      }

      const transaction = new RxManagedTransaction(txc)

      await transaction.rollback().toPromise()

      expect(txc.rollback).toHaveBeenCalled()
    })

    it('should fail if to the original Transaction.close call fails', async () => {
      const expectedError = new Error('expected')
      const txc = {
        rollback: jasmine
          .createSpy('rollback')
          .and.returnValue(Promise.reject(expectedError))
      }

      const transaction = new RxManagedTransaction(txc)

      try {
        await transaction.rollback().toPromise()
        fail('should have thrown')
      } catch (error) {
        expect(error).toBe(expectedError)
      }
    })
  })

  describe('.close()', () => {
    it('should delegate to the original Transaction', async () => {
      const txc = {
        close: jasmine.createSpy('close').and.returnValue(Promise.resolve())
      }

      const transaction = new RxManagedTransaction(txc)

      await transaction.close().toPromise()

      expect(txc.close).toHaveBeenCalled()
    })

    it('should fail if to the original Transaction.close call fails', async () => {
      const expectedError = new Error('expected')
      const txc = {
        close: jasmine
          .createSpy('close')
          .and.returnValue(Promise.reject(expectedError))
      }

      const transaction = new RxManagedTransaction(txc)

      try {
        await transaction.close().toPromise()
        fail('should have thrown')
      } catch (error) {
        expect(error).toBe(expectedError)
      }
    })
  })
})
