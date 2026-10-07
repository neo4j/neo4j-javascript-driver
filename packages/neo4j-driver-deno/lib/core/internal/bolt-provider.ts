import { ProtocolVersion } from '../protocol-version.ts'
import { EncryptedValue } from '../encryption/encrypted-value.ts'
import { newError } from '../error.ts'
import UnsupportedType from '../unsupported-type.ts'

export class BoltProvider {
  private readonly _boltVersions: Map<string, { version: ProtocolVersion, bolt: any }>
  private readonly _defaultMajorVersion: string
  private readonly _alloc: (n: number | ArrayBuffer | Int8Array) => any
  private readonly _defaultBolt: any

  constructor (boltVersions: Map<string, any>, defaultVersion: string, alloc: (n: number | ArrayBuffer | Int8Array) => any) {
    this._boltVersions = boltVersions
    this._defaultMajorVersion = defaultVersion
    this._alloc = alloc
    this._defaultBolt = this._boltVersions.get(this._defaultMajorVersion)?.bolt
  }

  encodeValue (value: any): ArrayBuffer {
    const buf = new EncodingBuffer()
    const packer = this._defaultBolt._createPacker(buf)
    packer.packable(value, this._defaultBolt.transformer.toStructure)()
    return buf.buffer()
  }

  encodeAAD (value: any, protocolVersion: ProtocolVersion): ArrayBuffer {
    const version = this._boltVersions.get(protocolVersion.getMajor().toString())
    if (version?.version.isGreaterOrEqualTo(protocolVersion) === true) {
      const buf = new EncodingBuffer()
      const packer = this._defaultBolt._createPacker(buf)
      packer.packable(value, this._defaultBolt.transformer.toStructure)()
      return buf.buffer()
    }
    throw newError('Could not encode provided AAD as it was encoded with an unsupported encoding scheme')
  }

  decodeValue (buffer: ArrayBuffer, protocolVersion: ProtocolVersion): any {
    const version = this._boltVersions.get(protocolVersion.getMajor().toString())
    if (version?.version.isGreaterOrEqualTo(protocolVersion) === true) {
      return version.bolt.unpack(this._alloc(buffer))
    }
    return new UnsupportedType('Undecryptable Value', protocolVersion.getMajor(), protocolVersion.getMinor(), 'Encrypted value was encoded with a newer driver, you must update your driver version to decode it.')
  }

  encodeObject (object: any): Int8Array {
    const transformer = this._defaultBolt.transformer
    const struct = transformer.toStructure(object)
    const buf = new EncodingBuffer()
    buf.writeInt8(1)
    const packer = this._defaultBolt._createPacker(buf)
    packer.packable(struct, this._defaultBolt.transformer.toStructure)()
    return new Int8Array(buf.buffer())
  }

  decodeObject (buffer: Int8Array): EncryptedValue {
    if(buffer.length === 0) {
      throw newError("Empty byte array provided as ciphertext to decryption.")
    }
    if (buffer[0] === 1) {
      const transformer = this._defaultBolt.transformer
      const packBuf = this._alloc(buffer.buffer.slice(1) as ArrayBuffer)
      const struct = this._defaultBolt.unpack(packBuf)
      if(packBuf.hasRemaining()) {
        throw newError(`Found data remaining after decoding ciphertext and metadata, unclean decode.`)
      }
      return transformer.fromStructure(struct)
    } else {
      throw newError(`Object is encoded with version ${buffer[0]}, this driver only supports version 1.`)
    }
  }
}

class EncodingBuffer {
  private _list: Int8Array
  private _location: number
  constructor () {
    this._list = new Int8Array(100000)
    this._location = 0
  }

  writeUInt8 (val: number): void {
    this._checkLength(1)
    const dv = new DataView(this._list.buffer)
    dv.setUint8(this._location, val)
    this._location += 1
  }

  writeInt8 (val: number): void {
    this._checkLength(1)
    const dv = new DataView(this._list.buffer)
    dv.setInt8(this._location, val)
    this._location += 1
  }

  writeInt16 (val: number): void {
    this._checkLength(2)
    const dv = new DataView(this._list.buffer)
    dv.setInt16(this._location, val)
    this._location += 2
  }

  writeInt32 (val: number): void {
    this._checkLength(4)
    const dv = new DataView(this._list.buffer)
    dv.setInt32(this._location, val)
    this._location += 4
  }

  writeFloat64 (val: number): void {
    this._checkLength(8)
    const dv = new DataView(this._list.buffer)
    dv.setFloat64(this._location, val)
    this._location += 8
  }

  writeBytes (val: any): void {
    const arr = new Int8Array(val._buffer)
    this._checkLength(arr.byteLength)
    for (let i = 0; i < arr.byteLength; i++) {
      this.writeInt8(arr[i])
    }
  }

  buffer (): ArrayBuffer {
    return this._list.slice(0, this._location).buffer
  }

  _checkLength (size: number): void {
    if (this._location + size >= this._list.byteLength) {
      const valArray = new Int8Array(100000)
      const combined = new Int8Array([
        ...this._list,
        ...valArray
      ])
      this._list = combined
    }
  }
}
