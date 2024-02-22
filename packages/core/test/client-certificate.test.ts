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

import { ClientCertificateProvider, RotatingClientCertificateProvider, clientCertificateProviders, resolveCertificateProvider } from '../src/client-certificate'

describe('clientCertificateProviders', () => {
  describe('.rotating()', () => {
    describe.each([
      undefined,
      null,
      {},
      { initialCertificate: null },
      {
        someOtherProperty: {
          certfile: 'other_file',
          keyfile: 'some_file',
          password: 'pass'
        }
      },
      ...invalidCertificates().map(initialCertificate => ({ initialCertificate }))
    ])('when invalid configuration (%o)', (config) => {
      it('should thrown TypeError', () => {
        // @ts-expect-error
        expect(() => clientCertificateProviders.rotating(config))
          .toThrow(TypeError)
      })
    })

    describe.each([
      {
        initialCertificate: {
          certfile: 'other_file',
          keyfile: 'some_file',
          password: 'pass'
        }
      },
      {
        initialCertificate: {
          certfile: 'other_file',
          keyfile: 'some_file'
        }
      },
      {
        initialCertificate: {
          get certfile () { return 'other_file' },
          get keyfile () { return 'some_file' },
          get password () { return 'pass' }
        }
      },
      {
        initialCertificate: {
          get certfile () { return 'other_file' },
          get keyfile () { return 'some_file' }
        }
      }
    ])('when valid configuration (%o)', (config) => {
      it('should return a RotatingClientCertificateProvider', () => {
        const provider = clientCertificateProviders.rotating(config)

        expect(provider).toBeDefined()
        expect(provider.getClientCertificate).toBeInstanceOf(Function)
        expect(provider.hasUpdate).toBeInstanceOf(Function)
        expect(provider.updateCertificate).toBeInstanceOf(Function)
      })

      it('should getClientCertificate return a copy of initialCertificate until certificate is not update', async () => {
        const provider = clientCertificateProviders.rotating(config)

        for (let i = 0; i < 100; i++) {
          const certificate = await provider.getClientCertificate()
          expect(certificate).toEqual(config.initialCertificate)
          expect(certificate).not.toBe(config.initialCertificate)
        }

        provider.updateCertificate({
          certfile: 'new_cert_file',
          keyfile: 'new_key_file',
          password: 'new_pass_word'
        })

        const certificate = await provider.getClientCertificate()
        expect(certificate).not.toEqual(config.initialCertificate)
        expect(certificate).not.toBe(config.initialCertificate)
      })

      it('should updateCertificate change certificate for a new one', async () => {
        const provider = clientCertificateProviders.rotating(config)

        await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(config.initialCertificate)

        for (let i = 0; i < 100; i++) {
          const certificate = {
            certfile: `new_cert_file${i}`,
            keyfile: `new_key_file${i}`,
            password: i % 2 === 0 ? `new_pass_word${i}` : undefined
          }

          provider.updateCertificate(certificate)

          await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(certificate)
          await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(certificate)
          await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(certificate)
        }
      })

      it.each([
        ...invalidCertificates(),
        null,
        undefined
      ])('should updateCertificate change certificate for a new one', async (invalidCertificate) => {
        const provider = clientCertificateProviders.rotating(config)

        await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(config.initialCertificate)

        // @ts-expect-error
        expect(() => provider.updateCertificate(invalidCertificate)).toThrow(TypeError)
      })

      it('should hasUpdate Return false, unless updateCertificate() was called since the last call of hasUpdate', async () => {
        const provider = clientCertificateProviders.rotating(config)

        await expect(Promise.resolve(provider.hasUpdate())).resolves.toBe(false)

        const certificate = {
          certfile: 'new_cert_file',
          keyfile: 'new_key_file'
        }
        provider.updateCertificate(certificate)

        await expect(Promise.resolve(provider.hasUpdate())).resolves.toBe(true)
        await expect(Promise.resolve(provider.hasUpdate())).resolves.toBe(false)

        await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(certificate)
        provider.updateCertificate(certificate)
        await expect(Promise.resolve(provider.getClientCertificate())).resolves.toEqual(certificate)

        await expect(Promise.resolve(provider.hasUpdate())).resolves.toBe(true)
        await expect(Promise.resolve(provider.hasUpdate())).resolves.toBe(false)
      })
    })
  })
})

describe('resolveCertificateProvider', () => {
  const rotatingProvider = clientCertificateProviders.rotating({ initialCertificate: { certfile: 'certfile', keyfile: 'keyfile' } })
  const customProvider: ClientCertificateProvider = {
    getClientCertificate () {
      return { certfile: 'certfile', keyfile: 'keyfile' }
    },
    hasUpdate () {
      return false
    }
  }

  const customRotatingProvider: RotatingClientCertificateProvider = {
    getClientCertificate () {
      return { certfile: 'certfile', keyfile: 'keyfile' }
    },
    hasUpdate () {
      return false
    },
    updateCertificate (certificate) {
    }
  }

  it.each([
    [undefined, undefined],
    [undefined, null],
    [rotatingProvider, rotatingProvider],
    [customProvider, customProvider],
    [customRotatingProvider, customRotatingProvider]
  ])('should return %o when called with %o', (expectedResult, input) => {
    expect(resolveCertificateProvider(input)).toBe(expectedResult)
  })

  it.each([
    { certfile: 'certfile', keyfile: 'keyfile' },
    { certfile: 'certfile', keyfile: 'keyfile', password: 'password' },
    { get certfile () { return 'the cert file' }, get keyfile () { return 'the key file' } },
    { get certfile () { return 'the cert file' }, get keyfile () { return 'the key file' }, get password () { return 'the password' } }
  ])('should a static provider when configured with ClientCertificate ', async (certificate) => {
    const maybeProvider = resolveCertificateProvider(certificate)

    expect(maybeProvider).toBeDefined()

    expect(maybeProvider?.getClientCertificate).toBeInstanceOf(Function)
    expect(maybeProvider?.hasUpdate).toBeInstanceOf(Function)
    // @ts-expect-error
    expect(maybeProvider?.updateCertificate).toBeUndefined()

    for (let i = 0; i < 100; i++) {
      await expect(Promise.resolve(maybeProvider?.getClientCertificate())).resolves.toEqual(certificate)
      await expect(Promise.resolve(maybeProvider?.getClientCertificate())).resolves.not.toBe(certificate)
      await expect(Promise.resolve(maybeProvider?.hasUpdate())).resolves.toBe(false)
    }
  })

  it.each([
    ...invalidCertificates(),
    { getClientCertificate () {} },
    { hasUpdate () {} },
    { updateCertificate () {} },
    { getClientCertificate () {}, hasUpdate: true },
    { getClientCertificate () {}, get hasUpdate () { return true } },
    { getClientCertificate: 'certificate', hasUpdate () {} }
  ])('should thrown when object is not a ClientCertificate, ClientCertificateProvider or absent (%o)', (value) => {
    expect(() => resolveCertificateProvider(value)).toThrow(TypeError)
  })
})

function invalidCertificates (): any[] {
  return [
    [],
    ['certfile', 'file', 'keyfile', 'the key file'],
    { certfile: 'file' },
    { keyfile: 'file' },
    { password: 'password_123' },
    { certfile: 123, keyfile: 'file' },
    { certfile: 'file', keyfile: 3.4 },
    { certfile: 3.5, keyfile: 3.4 },
    { certfile: 'sAED', keyfile: Symbol.asyncIterator },
    { certfile: '123', keyfile: 'file', password: 123 },
    { certfile () { return 'the cert file' }, get keyfile () { return 'the key file' } },
    { get certfile () { return 'the cert file' }, keyfile () { return 'the key file' } },
    { get certfile () { return 'the cert file' }, get keyfile () { return 'the key file' }, password () { return 'the password' } }
  ]
}
