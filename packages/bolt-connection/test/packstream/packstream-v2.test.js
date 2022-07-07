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

import { int, Integer, DateTime } from 'neo4j-driver-core'
import { alloc } from '../../src/channel'
import { Packer, Unpacker } from '../../src/packstream/packstream-v2'
import { Structure } from '../../src/packstream/packstream-v1'

describe('#unit PackStreamV2', () => {
  it('should pack integers with small numbers', () => {
    let n, i
    // test small numbers
    for (n = -999; n <= 999; n += 1) {
      i = int(n)
      expect(packAndUnpack(i).toString()).toBe(i.toString())
      expect(
        packAndUnpack(i, { disableLosslessIntegers: true }).toString()
      ).toBe(i.toString())
      expect(packAndUnpack(i, { useBigInt: true }).toString()).toBe(
        i.toString()
      )
    }
  })

  it('should pack integers with small numbers created with Integer', () => {
    let n, i
    // test small numbers
    for (n = -10; n <= 10; n += 1) {
      i = new Integer(n, 0)
      expect(packAndUnpack(i).toString()).toBe(i.toString())
      expect(
        packAndUnpack(i, { disableLosslessIntegers: true }).toString()
      ).toBe(i.toString())
      expect(packAndUnpack(i, { useBigInt: true }).toString()).toBe(
        i.toString()
      )
    }
  })

  it('should pack integers with positive numbers', () => {
    let n, i
    // positive numbers
    for (n = 16; n <= 16; n += 1) {
      i = int(Math.pow(2, n))
      expect(packAndUnpack(i).toString()).toBe(i.toString())

      const unpackedLossyInteger = packAndUnpack(i, {
        disableLosslessIntegers: true
      })
      expect(typeof unpackedLossyInteger).toBe('number')
      expect(unpackedLossyInteger.toString()).toBe(
        i.inSafeRange() ? i.toString() : 'Infinity'
      )

      const bigint = packAndUnpack(i, { useBigInt: true })
      expect(typeof bigint).toBe('bigint')
      expect(bigint.toString()).toBe(i.toString())
    }
  })

  it('should pack integer with negative numbers', () => {
    let n, i
    // negative numbers
    for (n = 0; n <= 63; n += 1) {
      i = int(-Math.pow(2, n))
      expect(packAndUnpack(i).toString()).toBe(i.toString())

      const unpackedLossyInteger = packAndUnpack(i, {
        disableLosslessIntegers: true
      })
      expect(typeof unpackedLossyInteger).toBe('number')
      expect(unpackedLossyInteger.toString()).toBe(
        i.inSafeRange() ? i.toString() : '-Infinity'
      )

      const bigint = packAndUnpack(i, { useBigInt: true })
      expect(typeof bigint).toBe('bigint')
      expect(bigint.toString()).toBe(i.toString())
    }
  })

  it('should pack BigInt with small numbers', () => {
    let n, i
    // test small numbers
    for (n = -999; n <= 999; n += 1) {
      i = BigInt(n)
      expect(packAndUnpack(i).toString()).toBe(i.toString())
      expect(
        packAndUnpack(i, { disableLosslessIntegers: true }).toString()
      ).toBe(i.toString())
      expect(packAndUnpack(i, { useBigInt: true }).toString()).toBe(
        i.toString()
      )
    }
  })

  it('should pack BigInt with positive numbers', () => {
    let n, i
    // positive numbers
    for (n = 16; n <= 16; n += 1) {
      i = BigInt(Math.pow(2, n))
      expect(packAndUnpack(i).toString()).toBe(i.toString())

      const unpackedLossyInteger = packAndUnpack(i, {
        disableLosslessIntegers: true
      })
      expect(typeof unpackedLossyInteger).toBe('number')
      expect(unpackedLossyInteger.toString()).toBe(
        int(i).inSafeRange() ? i.toString() : 'Infinity'
      )

      const bigint = packAndUnpack(i, { useBigInt: true })
      expect(typeof bigint).toBe('bigint')
      expect(bigint.toString()).toBe(i.toString())
    }
  })

  it('should pack BigInt with negative numbers', () => {
    let n, i
    // negative numbers
    for (n = 0; n <= 63; n += 1) {
      i = BigInt(-Math.pow(2, n))
      expect(packAndUnpack(i).toString()).toBe(i.toString())

      const unpackedLossyInteger = packAndUnpack(i, {
        disableLosslessIntegers: true
      })
      expect(typeof unpackedLossyInteger).toBe('number')
      expect(unpackedLossyInteger.toString()).toBe(
        int(i).inSafeRange() ? i.toString() : '-Infinity'
      )

      const bigint = packAndUnpack(i, { useBigInt: true })
      expect(typeof bigint).toBe('bigint')
      expect(bigint.toString()).toBe(i.toString())
    }
  })

  it('should pack strings', () => {
    expect(packAndUnpack('')).toBe('')
    expect(packAndUnpack('abcdefg123567')).toBe('abcdefg123567')
    const str = Array(65536 + 1).join('a') // 2 ^ 16 + 1
    expect(packAndUnpack(str, { bufferSize: str.length + 8 })).toBe(str)
  })

  it('should pack structures', () => {
    expect(packAndUnpack(new Structure(1, ['Hello, world!!!'])).fields[0]).toBe(
      'Hello, world!!!'
    )
  })

  it('should pack lists', () => {
    const list = ['a', 'b']
    const unpacked = packAndUnpack(list)
    expect(unpacked[0]).toBe(list[0])
    expect(unpacked[1]).toBe(list[1])
  })

  it('should pack long lists', () => {
    const listLength = 256
    const list = []
    for (let i = 0; i < listLength; i++) {
      list.push(null)
    }
    const unpacked = packAndUnpack(list, { bufferSize: 1400 })
    expect(unpacked[0]).toBe(list[0])
    expect(unpacked[1]).toBe(list[1])
  })

  describe('utc', () => {
    it.each([
      [
        'DateTimeWithZoneOffset',
        new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 120 * 60)
      ],
      [
        'DateTimeWithZoneId / Berlin 2:30 CET',
        new DateTime(2022, 10, 30, 2, 30, 0, 183_000_000, 2 * 60 * 60, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Berlin 2:30 CEST',
        new DateTime(2022, 10, 30, 2, 30, 0, 183_000_000, 1 * 60 * 60, 'Europe/Berlin')
      ]
    ])('should pack temporal types (%s)', (_, object) => {
      
      const unpacked = packAndUnpack(object, { disableLosslessIntegers: true, useUtc: true })

      expect(unpacked).toEqual(object)
    })

    it.each([
      [
        'DateTimeWithZoneId / Australia',
        new DateTime(2022, 6, 15, 15, 21, 18, 183_000_000, undefined, 'Australia/Eucla')
      ],
      [
        'DateTimeWithZoneId',
        new DateTime(2022, 6, 22, 15, 21, 18, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just before turn CEST',
        new DateTime(2022, 3, 27, 1, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just 1 before turn CEST',
        new DateTime(2022, 3, 27, 0, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just after turn CEST',
        new DateTime(2022, 3, 27, 3, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just 1 after turn CEST',
        new DateTime(2022, 3, 27, 4, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just before turn CET',
        new DateTime(2022, 10, 30, 2, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just 1 before turn CET',
        new DateTime(2022, 10, 30, 1, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just after turn CET',
        new DateTime(2022, 10, 30, 3, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Europe just 1 after turn CET',
        new DateTime(2022, 10, 30, 4, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just before turn summer time',
        new DateTime(2018, 11, 4, 11, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just 1 before turn summer time',
        new DateTime(2018, 11, 4, 10, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just after turn summer time',
        new DateTime(2018, 11, 5, 1, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just 1 after turn summer time',
        new DateTime(2018, 11, 5, 2, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just before turn winter time',
        new DateTime(2019, 2, 17, 11, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just 1 before turn winter time',
        new DateTime(2019, 2, 17, 10, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just after turn winter time',
        new DateTime(2019, 2, 18, 0, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
      ],
      [
        'DateTimeWithZoneId / Sao Paulo just 1 after turn winter time',
        new DateTime(2019, 2, 18, 1, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
      ]
    ])('should pack and unpack DateTimeWithZoneId and without offset (%s)', (_, object) => {
      const unpacked = packAndUnpack(object, { disableLosslessIntegers: true, useUtc: true})

      expect(unpacked.timeZoneOffsetSeconds).toBeDefined()

      const unpackedDateTimeWithoutOffset = new DateTime(
        unpacked.year,
        unpacked.month,
        unpacked.day,
        unpacked.hour,
        unpacked.minute,
        unpacked.second,
        unpacked.nanosecond,
        undefined,
        unpacked.timeZoneId
      )

      expect(unpackedDateTimeWithoutOffset).toEqual(object)
    })

    it.each([
      [
        'DateTimeWithZoneOffset with less fields',
        new Structure(0x49, [1, 2])
      ],
      [
        'DateTimeWithZoneOffset with more fields',
        new Structure(0x49, [1, 2, 3, 4])
      ],
      [
        'DateTimeWithZoneId with less fields',
        new Structure(0x69, [1, 2])
      ],
      [
        'DateTimeWithZoneId with more fields',
        new Structure(0x69, [1, 2, 'America/Sao Paulo', 'Brasil'])
      ]
    ])('should not unpack with wrong size (%s)', (_, struct) => {
      const result = packAndUnpack(struct, { useUtc: true })
      // Errors are postponed for when the data is accessed.
      expect(() => result instanceof DateTime).toThrowErrorMatchingSnapshot()
    })

    it.each([
      [
        'DateTimeWithZoneOffset',
        new Structure(0x49, [
          int(1655212878), int(183_000_000), int(120 * 60)
        ]),
        new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 120 * 60)
      ],
      [
        'DateTimeWithZoneId',
        new Structure(0x69, [
          int(1655212878), int(183_000_000), 'Europe/Berlin'
        ]),
        new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 2 * 60 * 60, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Australia',
        new Structure(0x69, [
          int(1655212878), int(183_000_000), 'Australia/Eucla'
        ]),
        new DateTime(2022, 6, 14, 22, 6, 18, 183_000_000, 8 * 60 * 60 + 45 * 60, 'Australia/Eucla')
      ]
    ])('should unpack temporal types (%s)', (_, struct, object) => {
      const unpacked = packAndUnpack(struct, { disableLosslessIntegers: true, useUtc: true})
      expect(unpacked).toEqual(object)
    })
  
    it.each([
      [
        'DateTimeWithZoneOffset/0x46',
        new Structure(0x46, [1, 2, 3])
      ],
      [
        'DateTimeWithZoneId/0x66',
        new Structure(0x66, [1, 2, 'America/Sao_Paulo'])
      ]
    ])('should unpack deprecated temporal types as unknown structs (%s)', (_, struct) => {
      const unpacked = packAndUnpack(struct, { disableLosslessIntegers: true, useUtc: true})
      expect(unpacked).toEqual(struct)
    })
  })

  describe('non-utc', () => {
    it.each([
      [
        'DateTimeWithZoneOffset/0x49',
        new Structure(0x49, [1, 2, 3])
      ],
      [
        'DateTimeWithZoneId/0x69',
        new Structure(0x69, [1, 2, 'America/Sao_Paulo'])
      ]
    ])('should unpack utc temporal types as unknown structs (%s)', (_, struct) => {
      const unpacked = packAndUnpack(struct, { disableLosslessIntegers: true })
      expect(unpacked).toEqual(struct)
    })

    it.each([
      [
        'DateTimeWithZoneOffset',
        new Structure(0x46, [int(1), int(2), int(3)]),
        new DateTime(1970, 1, 1, 0, 0, 1, 2, 3)
      ],
      [
        'DateTimeWithZoneId',
        new Structure(0x66, [int(1), int(2), 'America/Sao_Paulo']),
        new DateTime(1970, 1, 1, 0, 0, 1, 2, undefined, 'America/Sao_Paulo')
      ]
    ])('should unpack temporal types without utc fix (%s)', (_, struct, object) => {
      const unpacked = packAndUnpack(struct, { disableLosslessIntegers: true })
      expect(unpacked).toEqual(object)
    })

    it.each([
      ['DateTimeWithZoneId', new DateTime(1, 1, 1, 1, 1, 1, 1, undefined, 'America/Sao_Paulo')],
      ['DateTime', new DateTime(1, 1, 1, 1, 1, 1, 1, 1)]
    ])('should pack temporal types (no utc) (%s)', (_, object) => {
      const unpacked = packAndUnpack(object, { disableLosslessIntegers: true })
      expect(unpacked).toEqual(object)
    })
  })
})

function packAndUnpack (
  val,
  { bufferSize = 128, disableLosslessIntegers = false, useBigInt = false, useUtc = false} = {}
) {
  const buffer = alloc(bufferSize)
  const packer = new Packer(buffer)
  packer.useUtc = useUtc
  packer.packable(val)()
  buffer.reset()
  const unpacker = new Unpacker(disableLosslessIntegers, useBigInt)
  unpacker.useUtc = useUtc
  return unpacker.unpack(buffer)
}
