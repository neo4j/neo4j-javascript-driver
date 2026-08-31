import Integer from '../integer'

export class EncryptedValue {
  public profileName: string
  public cipherOutput: Int8Array
  public typeName: string
  public typeProtocolMajor: Integer
  public typeProtocolMinor: Integer
  public metadata: Record<string, any>
  constructor (
    cipherOutput: Int8Array,
    profileName: string,
    typeName: string,
    typeProtocolMajor: Integer,
    typeProtocolMinor: Integer,
    metadata: Record<string, any>

  ) {
    this.cipherOutput = cipherOutput
    this.profileName = profileName
    this.typeName = typeName
    this.typeProtocolMajor = typeProtocolMajor
    this.typeProtocolMinor = typeProtocolMinor
    this.metadata = {}
    Object.keys(metadata).sort().forEach((val) => { this.metadata[val] = metadata[val] })
  }

  /**
   * An indicator used to reliably determine if an object is a EncryptedValue or not.
   * @type {boolean}
   * @const
   * @expose
   * @private
   */
  static __isEncryptedValue__: boolean = true

  /**
   * Tests if the specified object is a EncryptedValue.
   * @access private
   * @param {*} obj Object
   * @returns {boolean}
   * @expose
   */
  static isEncryptedValue (obj: any): obj is EncryptedValue {
    return obj?.__isEncryptedValue__ === true
  }
}

Object.defineProperty(EncryptedValue.prototype, '__isEncryptedValue__', {
  value: true,
  enumerable: false,
  configurable: false
})

/**
 * Check if a variable is of EncryptedValue type.
 * @access public
 * @param {Mixed} value - The variable to check.
 * @return {Boolean} - Is it of the EncryptedValue type?
 */
export const isEnc = EncryptedValue.isEncryptedValue
