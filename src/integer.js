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

// 64-bit Integer library, originally from Long.js by dcodeIO
// https://github.com/dcodeIO/Long.js
// License Apache 2

import { newError } from './error'

/**
 * Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
 * See exported functions for more convenient ways of operating integers.
 * Use `int()` function to create new integers, `isInt()` to check if given object is integer,
 * `inSafeRange()` to check if it is safe to convert given value to native number,
 * `toNumber()` and `toString()` to convert given integer to number or string respectively.
 * @access public
 * @exports Integer
 * @class A Integer class for representing a 64 bit two's-complement integer value.
 * @param {number} low The low (signed) 32 bits of the long
 * @param {number} high The high (signed) 32 bits of the long
 * @constructor
 */
class Integer {
  constructor (low, high) {
    /**
     * The low 32 bits as a signed value.
     * @type {number}
     * @expose
     */
    this.low = low | 0

    /**
     * The high 32 bits as a signed value.
     * @type {number}
     * @expose
     */
    this.high = high | 0
  }

  // The internal representation of an Integer is the two given signed, 32-bit values.
  // We use 32-bit pieces because these are the size of integers on which
  // JavaScript performs bit-operations.  For operations like addition and
  // multiplication, we split each number into 16 bit pieces, which can easily be
  // multiplied within JavaScript's floating-point representation without overflow
  // or change in sign.
  //
  // In the algorithms below, we frequently reduce the negative case to the
  // positive case by negating the input(s) and then post-processing the result.
  // Note that we must ALWAYS check specially whether those values are MIN_VALUE
  // (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
  // a positive number, it overflows back into a negative).  Not handling this
  // case would often result in infinite recursion.
  //
  // Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the from*
  // methods on which they depend.

  inSafeRange () {
    return (
      this.greaterThanOrEqual(Integer.MIN_SAFE_VALUE) &&
      this.lessThanOrEqual(Integer.MAX_SAFE_VALUE)
    )
  }

  /**
   * Converts the Integer to an exact javascript Number, assuming it is a 32 bit integer.
   * @returns {number}
   * @expose
   */
  toInt () {
    return this.low
  }

  /**
   * Converts the Integer to a the nearest floating-point representation of this value (double, 53 bit mantissa).
   * @returns {number}
   * @expose
   */
  toNumber () {
    return this.high * TWO_PWR_32_DBL + (this.low >>> 0)
  }

  /**
   * Converts the Integer to native number or -Infinity/+Infinity when it does not fit.
   * @return {number}
   * @package
   */
  toNumberOrInfinity () {
    if (this.lessThan(Integer.MIN_SAFE_VALUE)) {
      return Number.NEGATIVE_INFINITY
    } else if (this.greaterThan(Integer.MAX_SAFE_VALUE)) {
      return Number.POSITIVE_INFINITY
    } else {
      return this.toNumber()
    }
  }

  /**
   * Converts the Integer to a string written in the specified radix.
   * @param {number=} radix Radix (2-36), defaults to 10
   * @returns {string}
   * @override
   * @throws {RangeError} If `radix` is out of range
   * @expose
   */
  toString (radix) {
    radix = radix || 10
    if (radix < 2 || radix > 36) {
      throw RangeError('radix out of range: ' + radix)
    }
    if (this.isZero()) {
      return '0'
    }
    var rem
    if (this.isNegative()) {
      if (this.equals(Integer.MIN_VALUE)) {
        // We need to change the Integer value before it can be negated, so we remove
        // the bottom-most digit in this base and then recurse to do the rest.
        var radixInteger = Integer.fromNumber(radix)
        var div = this.div(radixInteger)
        rem = div.multiply(radixInteger).subtract(this)
        return div.toString(radix) + rem.toInt().toString(radix)
      } else {
        return '-' + this.negate().toString(radix)
      }
    }

    // Do several (6) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = Integer.fromNumber(Math.pow(radix, 6))
    rem = this
    var result = ''
    while (true) {
      var remDiv = rem.div(radixToPower)
      var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt() >>> 0
      var digits = intval.toString(radix)
      rem = remDiv
      if (rem.isZero()) {
        return digits + result
      } else {
        while (digits.length < 6) {
          digits = '0' + digits
        }
        result = '' + digits + result
      }
    }
  }

  /**
   * Gets the high 32 bits as a signed integer.
   * @returns {number} Signed high bits
   * @expose
   */
  getHighBits () {
    return this.high
  }

  /**
   * Gets the low 32 bits as a signed integer.
   * @returns {number} Signed low bits
   * @expose
   */
  getLowBits () {
    return this.low
  }

  /**
   * Gets the number of bits needed to represent the absolute value of this Integer.
   * @returns {number}
   * @expose
   */
  getNumBitsAbs () {
    if (this.isNegative()) {
      return this.equals(Integer.MIN_VALUE) ? 64 : this.negate().getNumBitsAbs()
    }
    var val = this.high !== 0 ? this.high : this.low
    for (var bit = 31; bit > 0; bit--) {
      if ((val & (1 << bit)) !== 0) {
        break
      }
    }
    return this.high !== 0 ? bit + 33 : bit + 1
  }

  /**
   * Tests if this Integer's value equals zero.
   * @returns {boolean}
   * @expose
   */
  isZero () {
    return this.high === 0 && this.low === 0
  }

  /**
   * Tests if this Integer's value is negative.
   * @returns {boolean}
   * @expose
   */
  isNegative () {
    return this.high < 0
  }

  /**
   * Tests if this Integer's value is positive.
   * @returns {boolean}
   * @expose
   */
  isPositive () {
    return this.high >= 0
  }

  /**
   * Tests if this Integer's value is odd.
   * @returns {boolean}
   * @expose
   */
  isOdd () {
    return (this.low & 1) === 1
  }

  /**
   * Tests if this Integer's value is even.
   * @returns {boolean}
   * @expose
   */
  isEven () {
    return (this.low & 1) === 0
  }

  /**
   * Tests if this Integer's value equals the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {boolean}
   * @expose
   */
  equals (other) {
    if (!Integer.isInteger(other)) {
      other = Integer.fromValue(other)
    }
    return this.high === other.high && this.low === other.low
  }

  /**
   * Tests if this Integer's value differs from the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {boolean}
   * @expose
   */
  notEquals (other) {
    return !this.equals(/* validates */ other)
  }

  /**
   * Tests if this Integer's value is less than the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {boolean}
   * @expose
   */
  lessThan (other) {
    return this.compare(/* validates */ other) < 0
  }

  /**
   * Tests if this Integer's value is less than or equal the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {boolean}
   * @expose
   */
  lessThanOrEqual (other) {
    return this.compare(/* validates */ other) <= 0
  }

  /**
   * Tests if this Integer's value is greater than the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {boolean}
   * @expose
   */
  greaterThan (other) {
    return this.compare(/* validates */ other) > 0
  }

  /**
   * Tests if this Integer's value is greater than or equal the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {boolean}
   * @expose
   */
  greaterThanOrEqual (other) {
    return this.compare(/* validates */ other) >= 0
  }

  /**
   * Compares this Integer's value with the specified's.
   * @param {!Integer|number|string} other Other value
   * @returns {number} 0 if they are the same, 1 if the this is greater and -1
   *  if the given one is greater
   * @expose
   */
  compare (other) {
    if (!Integer.isInteger(other)) {
      other = Integer.fromValue(other)
    }
    if (this.equals(other)) {
      return 0
    }
    var thisNeg = this.isNegative()
    var otherNeg = other.isNegative()
    if (thisNeg && !otherNeg) {
      return -1
    }
    if (!thisNeg && otherNeg) {
      return 1
    }
    // At this point the sign bits are the same
    return this.subtract(other).isNegative() ? -1 : 1
  }

  /**
   * Negates this Integer's value.
   * @returns {!Integer} Negated Integer
   * @expose
   */
  negate () {
    if (this.equals(Integer.MIN_VALUE)) {
      return Integer.MIN_VALUE
    }
    return this.not().add(Integer.ONE)
  }

  /**
   * Returns the sum of this and the specified Integer.
   * @param {!Integer|number|string} addend Addend
   * @returns {!Integer} Sum
   * @expose
   */
  add (addend) {
    if (!Integer.isInteger(addend)) {
      addend = Integer.fromValue(addend)
    }

    // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

    var a48 = this.high >>> 16
    var a32 = this.high & 0xffff
    var a16 = this.low >>> 16
    var a00 = this.low & 0xffff

    var b48 = addend.high >>> 16
    var b32 = addend.high & 0xffff
    var b16 = addend.low >>> 16
    var b00 = addend.low & 0xffff

    var c48 = 0
    var c32 = 0
    var c16 = 0
    var c00 = 0
    c00 += a00 + b00
    c16 += c00 >>> 16
    c00 &= 0xffff
    c16 += a16 + b16
    c32 += c16 >>> 16
    c16 &= 0xffff
    c32 += a32 + b32
    c48 += c32 >>> 16
    c32 &= 0xffff
    c48 += a48 + b48
    c48 &= 0xffff
    return Integer.fromBits((c16 << 16) | c00, (c48 << 16) | c32)
  }

  /**
   * Returns the difference of this and the specified Integer.
   * @param {!Integer|number|string} subtrahend Subtrahend
   * @returns {!Integer} Difference
   * @expose
   */
  subtract (subtrahend) {
    if (!Integer.isInteger(subtrahend)) {
      subtrahend = Integer.fromValue(subtrahend)
    }
    return this.add(subtrahend.negate())
  }

  /**
   * Returns the product of this and the specified Integer.
   * @param {!Integer|number|string} multiplier Multiplier
   * @returns {!Integer} Product
   * @expose
   */
  multiply (multiplier) {
    if (this.isZero()) {
      return Integer.ZERO
    }
    if (!Integer.isInteger(multiplier)) {
      multiplier = Integer.fromValue(multiplier)
    }
    if (multiplier.isZero()) {
      return Integer.ZERO
    }
    if (this.equals(Integer.MIN_VALUE)) {
      return multiplier.isOdd() ? Integer.MIN_VALUE : Integer.ZERO
    }
    if (multiplier.equals(Integer.MIN_VALUE)) {
      return this.isOdd() ? Integer.MIN_VALUE : Integer.ZERO
    }

    if (this.isNegative()) {
      if (multiplier.isNegative()) {
        return this.negate().multiply(multiplier.negate())
      } else {
        return this.negate()
          .multiply(multiplier)
          .negate()
      }
    } else if (multiplier.isNegative()) {
      return this.multiply(multiplier.negate()).negate()
    }

    // If both longs are small, use float multiplication
    if (this.lessThan(TWO_PWR_24) && multiplier.lessThan(TWO_PWR_24)) {
      return Integer.fromNumber(this.toNumber() * multiplier.toNumber())
    }

    // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
    // We can skip products that would overflow.

    var a48 = this.high >>> 16
    var a32 = this.high & 0xffff
    var a16 = this.low >>> 16
    var a00 = this.low & 0xffff

    var b48 = multiplier.high >>> 16
    var b32 = multiplier.high & 0xffff
    var b16 = multiplier.low >>> 16
    var b00 = multiplier.low & 0xffff

    var c48 = 0
    var c32 = 0
    var c16 = 0
    var c00 = 0
    c00 += a00 * b00
    c16 += c00 >>> 16
    c00 &= 0xffff
    c16 += a16 * b00
    c32 += c16 >>> 16
    c16 &= 0xffff
    c16 += a00 * b16
    c32 += c16 >>> 16
    c16 &= 0xffff
    c32 += a32 * b00
    c48 += c32 >>> 16
    c32 &= 0xffff
    c32 += a16 * b16
    c48 += c32 >>> 16
    c32 &= 0xffff
    c32 += a00 * b32
    c48 += c32 >>> 16
    c32 &= 0xffff
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48
    c48 &= 0xffff
    return Integer.fromBits((c16 << 16) | c00, (c48 << 16) | c32)
  }

  /**
   * Returns this Integer divided by the specified.
   * @param {!Integer|number|string} divisor Divisor
   * @returns {!Integer} Quotient
   * @expose
   */
  div (divisor) {
    if (!Integer.isInteger(divisor)) {
      divisor = Integer.fromValue(divisor)
    }
    if (divisor.isZero()) {
      throw newError('division by zero')
    }
    if (this.isZero()) {
      return Integer.ZERO
    }
    var approx, rem, res
    if (this.equals(Integer.MIN_VALUE)) {
      if (divisor.equals(Integer.ONE) || divisor.equals(Integer.NEG_ONE)) {
        return Integer.MIN_VALUE
      }
      if (divisor.equals(Integer.MIN_VALUE)) {
        return Integer.ONE
      } else {
        // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
        var halfThis = this.shiftRight(1)
        approx = halfThis.div(divisor).shiftLeft(1)
        if (approx.equals(Integer.ZERO)) {
          return divisor.isNegative() ? Integer.ONE : Integer.NEG_ONE
        } else {
          rem = this.subtract(divisor.multiply(approx))
          res = approx.add(rem.div(divisor))
          return res
        }
      }
    } else if (divisor.equals(Integer.MIN_VALUE)) {
      return Integer.ZERO
    }
    if (this.isNegative()) {
      if (divisor.isNegative()) {
        return this.negate().div(divisor.negate())
      }
      return this.negate()
        .div(divisor)
        .negate()
    } else if (divisor.isNegative()) {
      return this.div(divisor.negate()).negate()
    }

    // Repeat the following until the remainder is less than other:  find a
    // floating-point that approximates remainder / other *from below*, add this
    // into the result, and subtract it from the remainder.  It is critical that
    // the approximate value is less than or equal to the real value so that the
    // remainder never becomes negative.
    res = Integer.ZERO
    rem = this
    while (rem.greaterThanOrEqual(divisor)) {
      // Approximate the result of division. This may be a little greater or
      // smaller than the actual value.
      approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()))

      // We will tweak the approximate result by changing it in the 48-th digit or
      // the smallest non-fractional digit, whichever is larger.
      var log2 = Math.ceil(Math.log(approx) / Math.LN2)
      var delta = log2 <= 48 ? 1 : Math.pow(2, log2 - 48)

      // Decrease the approximation until it is smaller than the remainder.  Note
      // that if it is too large, the product overflows and is negative.
      var approxRes = Integer.fromNumber(approx)
      var approxRem = approxRes.multiply(divisor)
      while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
        approx -= delta
        approxRes = Integer.fromNumber(approx)
        approxRem = approxRes.multiply(divisor)
      }

      // We know the answer can't be zero... and actually, zero would cause
      // infinite recursion since we would make no progress.
      if (approxRes.isZero()) {
        approxRes = Integer.ONE
      }

      res = res.add(approxRes)
      rem = rem.subtract(approxRem)
    }
    return res
  }

  /**
   * Returns this Integer modulo the specified.
   * @param {!Integer|number|string} divisor Divisor
   * @returns {!Integer} Remainder
   * @expose
   */
  modulo (divisor) {
    if (!Integer.isInteger(divisor)) {
      divisor = Integer.fromValue(divisor)
    }
    return this.subtract(this.div(divisor).multiply(divisor))
  }

  /**
   * Returns the bitwise NOT of this Integer.
   * @returns {!Integer}
   * @expose
   */
  not () {
    return Integer.fromBits(~this.low, ~this.high)
  }

  /**
   * Returns the bitwise AND of this Integer and the specified.
   * @param {!Integer|number|string} other Other Integer
   * @returns {!Integer}
   * @expose
   */
  and (other) {
    if (!Integer.isInteger(other)) {
      other = Integer.fromValue(other)
    }
    return Integer.fromBits(this.low & other.low, this.high & other.high)
  }

  /**
   * Returns the bitwise OR of this Integer and the specified.
   * @param {!Integer|number|string} other Other Integer
   * @returns {!Integer}
   * @expose
   */
  or (other) {
    if (!Integer.isInteger(other)) {
      other = Integer.fromValue(other)
    }
    return Integer.fromBits(this.low | other.low, this.high | other.high)
  }

  /**
   * Returns the bitwise XOR of this Integer and the given one.
   * @param {!Integer|number|string} other Other Integer
   * @returns {!Integer}
   * @expose
   */
  xor (other) {
    if (!Integer.isInteger(other)) {
      other = Integer.fromValue(other)
    }
    return Integer.fromBits(this.low ^ other.low, this.high ^ other.high)
  }

  /**
   * Returns this Integer with bits shifted to the left by the given amount.
   * @param {number|!Integer} numBits Number of bits
   * @returns {!Integer} Shifted Integer
   * @expose
   */
  shiftLeft (numBits) {
    if (Integer.isInteger(numBits)) {
      numBits = numBits.toInt()
    }
    if ((numBits &= 63) === 0) {
      return this
    } else if (numBits < 32) {
      return Integer.fromBits(
        this.low << numBits,
        (this.high << numBits) | (this.low >>> (32 - numBits))
      )
    } else {
      return Integer.fromBits(0, this.low << (numBits - 32))
    }
  }

  /**
   * Returns this Integer with bits arithmetically shifted to the right by the given amount.
   * @param {number|!Integer} numBits Number of bits
   * @returns {!Integer} Shifted Integer
   * @expose
   */
  shiftRight (numBits) {
    if (Integer.isInteger(numBits)) {
      numBits = numBits.toInt()
    }
    if ((numBits &= 63) === 0) {
      return this
    } else if (numBits < 32) {
      return Integer.fromBits(
        (this.low >>> numBits) | (this.high << (32 - numBits)),
        this.high >> numBits
      )
    } else {
      return Integer.fromBits(
        this.high >> (numBits - 32),
        this.high >= 0 ? 0 : -1
      )
    }
  }
}

/**
 * An indicator used to reliably determine if an object is a Integer or not.
 * @type {boolean}
 * @const
 * @expose
 * @private
 */
Integer.__isInteger__ = true

Object.defineProperty(Integer.prototype, '__isInteger__', {
  value: true,
  enumerable: false,
  configurable: false
})

/**
 * Tests if the specified object is a Integer.
 * @access private
 * @param {*} obj Object
 * @returns {boolean}
 * @expose
 */
Integer.isInteger = function (obj) {
  return (obj && obj.__isInteger__) === true
}

/**
 * A cache of the Integer representations of small integer values.
 * @type {!Object}
 * @inner
 * @private
 */
var INT_CACHE = {}

/**
 * Returns a Integer representing the given 32 bit integer value.
 * @access private
 * @param {number} value The 32 bit integer in question
 * @returns {!Integer} The corresponding Integer value
 * @expose
 */
Integer.fromInt = function (value) {
  var obj, cachedObj
  value = value | 0
  if (value >= -128 && value < 128) {
    cachedObj = INT_CACHE[value]
    if (cachedObj) {
      return cachedObj
    }
  }
  obj = new Integer(value, value < 0 ? -1 : 0, false)
  if (value >= -128 && value < 128) {
    INT_CACHE[value] = obj
  }
  return obj
}

/**
 * Returns a Integer representing the given value, provided that it is a finite number. Otherwise, zero is returned.
 * @access private
 * @param {number} value The number in question
 * @returns {!Integer} The corresponding Integer value
 * @expose
 */
Integer.fromNumber = function (value) {
  if (isNaN(value) || !isFinite(value)) {
    return Integer.ZERO
  }
  if (value <= -TWO_PWR_63_DBL) {
    return Integer.MIN_VALUE
  }
  if (value + 1 >= TWO_PWR_63_DBL) {
    return Integer.MAX_VALUE
  }
  if (value < 0) {
    return Integer.fromNumber(-value).negate()
  }
  return new Integer(value % TWO_PWR_32_DBL | 0, (value / TWO_PWR_32_DBL) | 0)
}

/**
 * Returns a Integer representing the 64 bit integer that comes by concatenating the given low and high bits. Each is
 *  assumed to use 32 bits.
 * @access private
 * @param {number} lowBits The low 32 bits
 * @param {number} highBits The high 32 bits
 * @returns {!Integer} The corresponding Integer value
 * @expose
 */
Integer.fromBits = function (lowBits, highBits) {
  return new Integer(lowBits, highBits)
}

/**
 * Returns a Integer representation of the given string, written using the specified radix.
 * @access private
 * @param {string} str The textual representation of the Integer
 * @param {number=} radix The radix in which the text is written (2-36), defaults to 10
 * @returns {!Integer} The corresponding Integer value
 * @expose
 */
Integer.fromString = function (str, radix) {
  if (str.length === 0) {
    throw newError('number format error: empty string')
  }
  if (
    str === 'NaN' ||
    str === 'Infinity' ||
    str === '+Infinity' ||
    str === '-Infinity'
  ) {
    return Integer.ZERO
  }
  radix = radix || 10
  if (radix < 2 || radix > 36) {
    throw newError('radix out of range: ' + radix)
  }

  var p
  if ((p = str.indexOf('-')) > 0) {
    throw newError('number format error: interior "-" character: ' + str)
  } else if (p === 0) {
    return Integer.fromString(str.substring(1), radix).negate()
  }

  // Do several (8) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = Integer.fromNumber(Math.pow(radix, 8))

  var result = Integer.ZERO
  for (var i = 0; i < str.length; i += 8) {
    var size = Math.min(8, str.length - i)
    var value = parseInt(str.substring(i, i + size), radix)
    if (size < 8) {
      var power = Integer.fromNumber(Math.pow(radix, size))
      result = result.multiply(power).add(Integer.fromNumber(value))
    } else {
      result = result.multiply(radixToPower)
      result = result.add(Integer.fromNumber(value))
    }
  }
  return result
}

/**
 * Converts the specified value to a Integer.
 * @access private
 * @param {!Integer|number|string|!{low: number, high: number}} val Value
 * @returns {!Integer}
 * @expose
 */
Integer.fromValue = function (val) {
  if (val /* is compatible */ instanceof Integer) {
    return val
  }
  if (typeof val === 'number') {
    return Integer.fromNumber(val)
  }
  if (typeof val === 'string') {
    return Integer.fromString(val)
  }
  // Throws for non-objects, converts non-instanceof Integer:
  return new Integer(val.low, val.high)
}

/**
 * Converts the specified value to a number.
 * @access private
 * @param {!Integer|number|string|!{low: number, high: number}} val Value
 * @returns {number}
 * @expose
 */
Integer.toNumber = function (val) {
  return Integer.fromValue(val).toNumber()
}

/**
 * Converts the specified value to a string.
 * @access private
 * @param {!Integer|number|string|!{low: number, high: number}} val Value
 * @param {number} radix optional radix for string conversion, defaults to 10
 * @returns {string}
 * @expose
 */
Integer.toString = function (val, radix) {
  return Integer.fromValue(val).toString(radix)
}

/**
 * Checks if the given value is in the safe range in order to be converted to a native number
 * @access private
 * @param {!Integer|number|string|!{low: number, high: number}} val Value
 * @param {number} radix optional radix for string conversion, defaults to 10
 * @returns {boolean}
 * @expose
 */
Integer.inSafeRange = function (val) {
  return Integer.fromValue(val).inSafeRange()
}

/**
 * @type {number}
 * @const
 * @inner
 * @private
 */
var TWO_PWR_16_DBL = 1 << 16

/**
 * @type {number}
 * @const
 * @inner
 * @private
 */
var TWO_PWR_24_DBL = 1 << 24

/**
 * @type {number}
 * @const
 * @inner
 * @private
 */
var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL

/**
 * @type {number}
 * @const
 * @inner
 * @private
 */
var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL

/**
 * @type {number}
 * @const
 * @inner
 * @private
 */
var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2

/**
 * @type {!Integer}
 * @const
 * @inner
 * @private
 */
var TWO_PWR_24 = Integer.fromInt(TWO_PWR_24_DBL)

/**
 * Signed zero.
 * @type {!Integer}
 * @expose
 */
Integer.ZERO = Integer.fromInt(0)

/**
 * Signed one.
 * @type {!Integer}
 * @expose
 */
Integer.ONE = Integer.fromInt(1)

/**
 * Signed negative one.
 * @type {!Integer}
 * @expose
 */
Integer.NEG_ONE = Integer.fromInt(-1)

/**
 * Maximum signed value.
 * @type {!Integer}
 * @expose
 */
Integer.MAX_VALUE = Integer.fromBits(0xffffffff | 0, 0x7fffffff | 0, false)

/**
 * Minimum signed value.
 * @type {!Integer}
 * @expose
 */
Integer.MIN_VALUE = Integer.fromBits(0, 0x80000000 | 0, false)

/**
 * Minimum safe value.
 * @type {!Integer}
 * @expose
 */
Integer.MIN_SAFE_VALUE = Integer.fromBits(0x1 | 0, 0xffffffffffe00000 | 0)

/**
 * Maximum safe value.
 * @type {!Integer}
 * @expose
 */
Integer.MAX_SAFE_VALUE = Integer.fromBits(0xffffffff | 0, 0x1fffff | 0)

/**
 * Cast value to Integer type.
 * @access public
 * @param {Mixed} value - The value to use.
 * @return {Integer} - An object of type Integer.
 */
const int = Integer.fromValue

/**
 * Check if a variable is of Integer type.
 * @access public
 * @param {Mixed} value - The variable to check.
 * @return {Boolean} - Is it of the Integer type?
 */
const isInt = Integer.isInteger

/**
 * Check if a variable can be safely converted to a number
 * @access public
 * @param {Mixed} value - The variable to check
 * @return {Boolean} - true if it is safe to call toNumber on variable otherwise false
 */
const inSafeRange = Integer.inSafeRange

/**
 * Converts a variable to a number
 * @access public
 * @param {Mixed} value - The variable to convert
 * @return {number} - the variable as a number
 */
const toNumber = Integer.toNumber

/**
 * Converts the integer to a string representation
 * @access public
 * @param {Mixed} value - The variable to convert
 * @param {number} radix - radix to use in string conversion, defaults to 10
 * @return {string} - returns a string representation of the integer
 */
const toString = Integer.toString

export { int, isInt, inSafeRange, toNumber, toString }

export default Integer
