const neo4j = require('neo4j-driver')

export class ResultObserver {
  constructor () {
    this.keys = null
    this._stream = []
    this.summary = null
    this._err = null
    this._promise = null
    this.onKeys = this.onKeys.bind(this)
    this.onNext = this.onNext.bind(this)
    this.onCompleted = this.onCompleted.bind(this)
    this.onError = this.onError.bind(this)
  }

  onKeys (keys) {
    this.keys = keys
  }

  onNext (record) {
    this._stream.push(record)
    this._fulfill()
  }

  onCompleted (summary) {
    this._summary = summary
    this._fulfill()
  }

  onError (e) {
    this._stream.push(e)
    this._fulfill()
  }

  // Returns a promise, only one outstanding next!
  next () {
    return new Promise((resolution, rejection) => {
      this._promise = {
        resolve: resolution,
        reject: rejection
      }
      this._fulfill()
    })
  }

  _fulfill () {
    if (!this._promise) {
      return
    }

    // The stream contains something
    if (this._stream.length) {
      const x = this._stream.shift()
      if (!(x instanceof neo4j.types.Record)) {
        // For further calls, use this (stream should be empty after this)
        this._err = x
        this._promise.reject(x)
        this._promise = null
        return
      }
      this._promise.resolve(x)
      this._promise = null
      return
    }

    // There has been an error, continue to return that error
    if (this._err) {
      this._promise.reject(this._err)
      this._promise = null
      return
    }

    // All records have been received
    if (this._summary) {
      this._promise.resolve(null)
      this._promise = null
    }
  }
}
