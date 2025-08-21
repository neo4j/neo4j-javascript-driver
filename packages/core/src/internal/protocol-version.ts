export class ProtocolVersion {
  private readonly major: number
  private readonly minor: number
  constructor (major: number, minor: number) {
    this.major = major
    this.minor = minor
  }

  getMajor (): number {
    return this.major
  }

  getMinor (): number {
    return this.major
  }

  isLessThan (other: ProtocolVersion): boolean {
    if (this.major < other.major) {
      return true
    } else if (this.major === other.major && this.minor < other.minor) {
      return true
    }
    return false
  }

  isGreaterThan (other: ProtocolVersion): boolean {
    if (this.major > other.major) {
      return true
    } else if (this.major === other.major && this.minor > other.minor) {
      return true
    }
    return false
  }

  isGreaterOrEqualTo (other: ProtocolVersion): boolean {
    return !this.isLessThan(other)
  }

  isLessOrEqualTo (other: ProtocolVersion): boolean {
    return !this.isGreaterThan(other)
  }

  equalTo (other: ProtocolVersion): boolean {
    return this.major === other.major && this.minor === other.minor
  }

  toString (): string {
    return this.major.toString() + '.' + this.minor.toString()
  }
}
