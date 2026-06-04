import { uuid } from '../src'

describe('UUID', () => {
  describe('uuid', () => {
    it.each([
      [
        '0 byteArray',
        Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      ],
      [
        '0 string',
        '00000000-0000-0000-0000-000000000000',
        Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      ],
      [
        'varied byteArray',
        Uint8Array.from([127, 255, 128, 16, 15, 8, 0, 11, 10, 56, 42, 19, 55, 103, 176, 23]),
        Uint8Array.from([127, 255, 128, 16, 15, 8, 0, 11, 10, 56, 42, 19, 55, 103, 176, 23])
      ],
      [
        'varied string',
        '7fFF8010-0f08-000b-0a38-2a133767B017',
        Uint8Array.from([127, 255, 128, 16, 15, 8, 0, 11, 10, 56, 42, 19, 55, 103, 176, 23])
      ]
    ])('should create UUID from (%s)', (_: any, rawUUID: Uint8Array | string, expectedByteArray: Uint8Array) => {
      const id = uuid(rawUUID)
      expect(id.getTypedArray()).toEqual(expectedByteArray)
    })

    it.each([
      ['array', [], 'Invalid argument type passed to UUID constructor function: expected Uint8Array or uuid string, got: Array'],
      ['Unsigned TypedArray', Uint16Array.from([]), 'Invalid argument type passed to UUID constructor function: expected Uint8Array or uuid string, got: Uint16Array'],
      ['undefined', undefined, 'Invalid argument type passed to UUID constructor function: expected Uint8Array or uuid string, got: undefined or type without constructor name'],
      ['incorrect string', 'ABBB1CA-AAAAA-AAAA-AAAA-AAAAAAAAAAAA', 'UUID string base16 encoded should be of format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or without any dashes, got: ABBB1CA-AAAAA-AAAA-AAAA-AAAAAAAAAAAA'],
      ['wrong length Uint8Array', Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'Uint8Array representation of UUID must be of length 16, got 0,1,2,3,4,5,6,7,8,9,10']
    ])('should fail to create create vector from (%s)', (_: any, rawUUID: Uint8Array | string, expectedMessage: string) => {
      // @ts-expect-error
      expect(() => uuid(rawUUID)).toThrow(expectedMessage)
    })
  })
  describe('.toString()', () => {
    it.each([
      ['all 0s', Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), '00000000-0000-0000-0000-000000000000'],
      ['varied uuid', Uint8Array.from([127, 255, 128, 16, 15, 8, 0, 11, 10, 56, 42, 19, 55, 103, 176, 23]), '7fff8010-0f08-000b-0a38-2a133767b017']
    ])('should correctly stringify (%s)', (_: any, rawUUID: Uint8Array | string, expectedString: string) => {
      const id = uuid(rawUUID)
      expect(id.toString()).toEqual(expectedString)
    })
  })
})
