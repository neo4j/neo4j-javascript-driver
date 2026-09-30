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
    if (buffer[0] === 1) {
      const transformer = this._defaultBolt.transformer
      const struct = this._defaultBolt.unpack(this._alloc(buffer.buffer.slice(1) as ArrayBuffer))
      return transformer.fromStructure(struct)
    } else {
      throw newError(`Object is encoded with version ${buffer[0]}, this driver only supports version 1.`)
    }
  }
}

class EncodingBuffer {
  private _list: Int8Array
  constructor () {
    this._list = new Int8Array(0)
  }

  concat (val: ArrayBuffer): void {
    const valArray = new Int8Array(val)
    const combined = new Int8Array([
      ...this._list,
      ...valArray
    ])
    this._list = combined
  }

  writeUInt8 (val: number): void {
    const dv = new DataView(new ArrayBuffer(1))
    dv.setUint8(0, val)
    this.concat(dv.buffer)
  }

  writeInt8 (val: number): void {
    const dv = new DataView(new ArrayBuffer(1))
    dv.setInt8(0, val)
    this.concat(dv.buffer)
  }

  writeInt16 (val: number): void {
    const dv = new DataView(new ArrayBuffer(2))
    dv.setInt16(0, val)
    this.concat(dv.buffer)
  }

  writeInt32 (val: number): void {
    const dv = new DataView(new ArrayBuffer(4))
    dv.setInt32(0, val)
    this.concat(dv.buffer)
  }

  writeFloat64 (val: number): void {
    const dv = new DataView(new ArrayBuffer(8))
    dv.setFloat64(0, val)
    this.concat(dv.buffer)
  }

  writeBytes (val: any): void {
    this.concat(val._buffer)
  }

  buffer (): ArrayBuffer {
    return this._list.buffer as ArrayBuffer
  }
}
