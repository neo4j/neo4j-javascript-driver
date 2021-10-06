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

import ConnectionErrorHandler from '../../src/connection/connection-error-handler'
import { newError, error, internal } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error

describe('#unit ConnectionErrorHandler', () => {
  it('should return error code', () => {
    const code = 'Neo4j.Error.Hello'
    const handler = new ConnectionErrorHandler(code)
    expect(code).toEqual(handler.errorCode())
  })

  it('should handle and transform availability errors', () => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const handler = new ConnectionErrorHandler(
      SERVICE_UNAVAILABLE,
      (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    )

    const error1 = newError('A', SERVICE_UNAVAILABLE)
    const error2 = newError('B', SESSION_EXPIRED)
    const error3 = newError(
      'C',
      'Neo.TransientError.General.DatabaseUnavailable'
    )

    const errorTransformed1 = handler.handleAndTransformError(
      error1,
      ServerAddress.fromUrl('localhost:0')
    )
    expect(errorTransformed1).toEqual(transformedError)

    const errorTransformed2 = handler.handleAndTransformError(
      error2,
      ServerAddress.fromUrl('localhost:1')
    )
    expect(errorTransformed2).toEqual(transformedError)

    const errorTransformed3 = handler.handleAndTransformError(
      error3,
      ServerAddress.fromUrl('localhost:2')
    )
    expect(errorTransformed3).toEqual(transformedError)

    expect(errors).toEqual([error1, error2, error3])
    expect(addresses).toEqual([
      ServerAddress.fromUrl('localhost:0'),
      ServerAddress.fromUrl('localhost:1'),
      ServerAddress.fromUrl('localhost:2')
    ])
  })

  it('should handle and transform authorization expired error', () => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const handler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleAuthorizationExpired: (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    })

    const error1 = newError(
      'C',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    const errorTransformed1 = handler.handleAndTransformError(
      error1,
      ServerAddress.fromUrl('localhost:0')
    )

    expect(errorTransformed1).toEqual(transformedError)

    expect(addresses).toEqual([ServerAddress.fromUrl('localhost:0')])
  })

  it('should return original erro if authorization expired handler is not informed', () => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const handler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleUnavailability: (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      },
      handleWriteFailure: (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    })

    const error1 = newError(
      'C',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    const errorTransformed1 = handler.handleAndTransformError(
      error1,
      ServerAddress.fromUrl('localhost:0')
    )

    expect(errorTransformed1).toEqual(error1)

    expect(addresses).toEqual([])
  })


  it('should handle and transform token expired error', () => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const handler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleAuthorizationExpired: (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    })

    const error1 = newError(
      'C',
      'Neo.ClientError.Security.TokenExpired'
    )

    const errorTransformed1 = handler.handleAndTransformError(
      error1,
      ServerAddress.fromUrl('localhost:0')
    )

    expect(errorTransformed1).toEqual(transformedError)

    expect(addresses).toEqual([ServerAddress.fromUrl('localhost:0')])
  })

  it('should return original erro if token expired handler is not informed', () => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const handler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleUnavailability: (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      },
      handleWriteFailure: (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    })

    const error1 = newError(
      'C',
      'Neo.ClientError.Security.TokenExpired'
    )

    const errorTransformed1 = handler.handleAndTransformError(
      error1,
      ServerAddress.fromUrl('localhost:0')
    )

    expect(errorTransformed1).toEqual(error1)

    expect(addresses).toEqual([])
  })

  it('should handle and transform failure to write errors', () => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const handler = new ConnectionErrorHandler(
      SERVICE_UNAVAILABLE,
      null,
      (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    )

    const error1 = newError('A', 'Neo.ClientError.Cluster.NotALeader')
    const error2 = newError(
      'B',
      'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase'
    )

    const errorTransformed1 = handler.handleAndTransformError(
      error1,
      ServerAddress.fromUrl('localhost:0')
    )
    expect(errorTransformed1).toEqual(transformedError)

    const errorTransformed2 = handler.handleAndTransformError(
      error2,
      ServerAddress.fromUrl('localhost:1')
    )
    expect(errorTransformed2).toEqual(transformedError)

    expect(errors).toEqual([error1, error2])
    expect(addresses).toEqual([
      ServerAddress.fromUrl('localhost:0'),
      ServerAddress.fromUrl('localhost:1')
    ])
  })
})
