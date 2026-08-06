
export class BoltProvider {
    private _boltVersions: Map<string, any>
    private _defaultVersion: string
    private _alloc: (n: number | ArrayBuffer) => any

    constructor(boltVersions: Map<string, any>, defaultVersion: string, alloc: (n: number | ArrayBuffer) => any) {
        this._boltVersions = boltVersions
        this._defaultVersion = defaultVersion
        this._alloc = alloc
    }
    encodeValue(value: any) {
        const version = this._boltVersions.get(this._defaultVersion)
        const buf = new EncodingBuffer()
        const packer = version._createPacker(buf)
        packer.packable(value, version.transformer.toStructure)()
        return buf.buffer()
    }
    decodeValue(buffer: ArrayBuffer, protocolVersion: string) {
        const version = this._boltVersions.get(protocolVersion)
        return version.unpack(this._alloc(buffer))
    }
    encodeObject(object: any) {
        const version = this._boltVersions.get(this._defaultVersion)
        const transformer = version.transformer
        const struct = transformer.toStructure(object)
        const buf = new EncodingBuffer()
        const packer = version._createPacker(buf)
        packer.packable(struct, version.transformer.toStructure)()
        return buf.buffer()
    }
    decodeObject(buffer: ArrayBuffer) {
        const version = this._boltVersions.get(this._defaultVersion)
        const transformer = version.transformer
        const struct = version.unpack(this._alloc(buffer))
        return transformer.fromStructure(struct)
    }
}

//TODO: MAKE THIS NOT SUCK!
class EncodingBuffer {
    private _list: number[]
    constructor() {
        this._list = []
    }

    writeUInt8(val: number): void {
        this._list = this._list.concat(val)
    }

    writeInt8(val: number): void {
        this._list = this._list.concat(val)
    }

    writeInt16(val: number): void {
        new Uint8Array(Int16Array.from([val]).buffer).forEach((val) => this._list = this._list.concat(val))
    }
    writeInt32(val: number): void {
        new Uint8Array(Int32Array.from([val]).buffer).forEach((val) => this._list = this._list.concat(val))
    }
    writeFloat64(val: number): void {
        new Uint8Array(Float64Array.from([val]).buffer).forEach((val) => this._list = this._list.concat(val))
    }

    writeBytes(val: any): void {
        const list = new Uint8Array(val._buffer)
        for (let i = 0; i < list.length; i++) {
            this._list = this._list.concat(list[i])
        }
    }

    buffer(): ArrayBuffer {
        return Uint8Array.from(this._list).buffer
    }
}