import neo4j from 'neo4j-driver'

export default class ResultObserver {
  constructor ({ sessionId }) {
    this.sessionId = sessionId
    this.keys = null
    this._stream = []
    this.summary = null
    this._err = null
    this._promise = null
    this.onKeys = this.onKeys.bind(this)
    this.onNext = this.onNext.bind(this)
    this.onCompleted = this.onCompleted.bind(this)
    this.onError = this.onError.bind(this)
    this._completitionPromise = null
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
    this._resolve(this._completitionPromise, summary)
    this._completitionPromise = null
  }

  onError (e) {
    this._stream.push(e)
    this._fulfill()
    this._reject(this._completitionPromise, e)
    this._completitionPromise = null
  }

  // Returns a promise, only one outstanding next!
  next () {
    return new Promise((resolve, reject) => {
      this._promise = {
        resolve,
        reject
      }
      this._fulfill()
    })
  }

  completitionPromise () {
    return new Promise((resolve, reject) => {
      if (this._summary) {
        resolve(this._summary)
      } else if (this._err) {
        reject(this._err)
      } else {
        this._completitionPromise = {
          resolve,
          reject
        }
      }
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

  _resolve (promise, data) {
    if (promise) {
      promise.resolve(data)
    }
  }

  _reject (promise, err) {
    if (promise) {
      promise.reject(err)
    }
  }
}
