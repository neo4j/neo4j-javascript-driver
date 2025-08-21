export class ProtocolVersion {
  constructor (major, minor) {
    this.major = major
    this.minor = minor
  }

  getMajor () {
    return this.major
  }

  getMinor () {
    return this.major
  }

  isLessThan (other) {
    if (this.major < other.major) {
      return true
    } else if (this.major === other.major && this.minor < other.minor) {
      return true
    }
    return false
  }

  isGreaterThan (other) {
    if (this.major > other.major) {
      return true
    } else if (this.major === other.major && this.minor > other.minor) {
      return true
    }
    return false
  }

  isGreaterOrEqualTo (other) {
    return !this.isLessThan(other)
  }

  isLessOrEqualTo (other) {
    return !this.isGreaterThan(other)
  }

  equalTo (other) {
    return this.major === other.major && this.minor === other.minor
  }

  toString () {
    return this.major.toString() + '.' + this.minor.toString()
  }
}
