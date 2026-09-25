import { EncryptedValue } from '../encryption/encrypted-value'
import { newError } from '../error'

export class BoltProvider {
  private readonly _boltVersions: Map<string, any>
  private readonly _defaultVersion: string
  private readonly _alloc: (n: number | ArrayBuffer | Int8Array) => any

  constructor (boltVersions: Map<string, any>, defaultVersion: string, alloc: (n: number | ArrayBuffer | Int8Array) => any) {
    this._boltVersions = boltVersions
    this._defaultVersion = defaultVersion
    this._alloc = alloc
  }

  encodeValue (value: any): ArrayBuffer {
    const version = this._boltVersions.get(this._defaultVersion)
    const buf = new EncodingBuffer()
    const packer = version._createPacker(buf)
    packer.packable(value, version.transformer.toStructure)()
    return buf.buffer()
  }

  decodeValue (buffer: ArrayBuffer, protocolVersion: string): any {
    const version = this._boltVersions.get(protocolVersion)
    return version.unpack(this._alloc(buffer))
  }

  encodeObject (object: any): Int8Array {
    const version = this._boltVersions.get(this._defaultVersion)
    const transformer = version.transformer
    const struct = transformer.toStructure(object)
    const buf = new EncodingBuffer()
    buf.writeInt8(1)
    const packer = version._createPacker(buf)
    packer.packable(struct, version.transformer.toStructure)()
    return new Int8Array(buf.buffer())
  }

  decodeObject (buffer: Int8Array): EncryptedValue {
    if (buffer[0] === 1) {
      const version = this._boltVersions.get(this._defaultVersion)
      const transformer = version.transformer
      const struct = version.unpack(this._alloc(buffer.buffer.slice(1) as ArrayBuffer))
      return transformer.fromStructure(struct)
    } else {
      throw newError(`Object is encoded with version ${buffer[0]}, this driver only supports version 1.`)
    }
  }
}

// TODO: MAKE THIS NOT SUCK!
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
