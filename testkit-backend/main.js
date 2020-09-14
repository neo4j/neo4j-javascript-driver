var neo4j = require('neo4j-driver')
var net = require('net')
var readline = require('readline')

function valueResponse (name, value) {
  return { name: name, data: { value: value } }
}

function nativeToCypher (x) {
  if (x == null) {
    return valueResponse('CypherNull', null)
  }
  switch (typeof x) {
    case 'number':
      if (Number.isInteger(x)) {
        return valueResponse('CypherNull', x)
      }
      break
    case 'string':
      return valueResponse('CypherString', x)
    case 'object':
      if (neo4j.isInt(x)) {
        // TODO: Broken!!!
        return valueResponse('CypherInt', x.toInt())
      }
      if (Array.isArray(x)) {
        const values = x.map(nativeToCypher)
        return valueResponse('CypherList', values)
      }
      if (x instanceof neo4j.types.Node) {
        const node = {
          id: nativeToCypher(x.identity),
          labels: nativeToCypher(x.labels),
          props: nativeToCypher(x.properties)
        }
        return { name: 'CypherNode', data: node }
      }
      // If all failed, interpret as a map
      const map = {}
      for (const [key, value] of Object.entries(x)) {
        map[key] = nativeToCypher(value)
      }
      return valueResponse('CypherMap', map)
  }

  const err = 'Unable to convert ' + x + ' to cypher type'
  console.log(err)
  throw Error(err)
}

function cypherToNative (c) {
  const {
    name,
    data: { value }
  } = c
  switch (name) {
    case 'CypherString':
      return value
    case 'CypherInt':
      return value
  }
  const err = 'Unable to convert ' + c + ' to native type'
  console.log(err)
  throw Error(err)
}

class ResultObserver {
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

class Backend {
  constructor ({ writer }) {
    console.log('Backend connected')
    this._inRequest = false
    this._request = ''
    // Event handlers need to be bound to this instance
    this.onLine = this.onLine.bind(this)
    this._id = 0
    this._writer = writer
    this._drivers = {}
    this._sessions = {}
    this._resultObservers = {}
    this._errors = {}
    this._txs = {}
  }

  // Called whenever a new line is received.
  onLine (line) {
    switch (line) {
      case '#request begin':
        if (this._inRequest) {
          throw 'Already in request'
        }
        this._inRequest = true
        break
      case '#request end':
        if (!this._inRequest) {
          throw 'End while not in request'
        }
        try {
          this._handleRequest(this._request)
        } catch (e) {
          this._writeBackendError(e)
        }
        this._request = ''
        this._inRequest = false
        break
      default:
        if (!this._inRequest) {
          throw 'Line while not in request'
        }
        this._request += line
        break
    }
  }

  _handleRequest (request) {
    request = JSON.parse(request)
    const { name, data } = request
    console.log('> Got request ' + name, data)
    switch (name) {
      case 'NewDriver':
        {
          const {
            uri,
            authorizationToken: { data: authToken }
          } = data
          const driver = neo4j.driver(uri, authToken)
          this._id++
          this._drivers[this._id] = driver
          this._writeResponse('Driver', { id: this._id })
        }
        break

      case 'DriverClose':
        {
          const { driverId } = data
          const driver = this._drivers[driverId]
          driver.close().then(() => {
            this._writeResponse('Driver', { id: driverId })
          })
        }
        break

      case 'NewSession':
        {
          let { driverId, accessMode, bookmarks } = data
          switch (accessMode) {
            case 'r':
              accessMode = neo4j.READ
              break
            case 'w':
              accessMode = neo4j.WRITE
              break
            default:
              this._writeBackendError('Unknown accessmode: ' + accessMode)
              return
          }
          const driver = this._drivers[driverId]
          const session = driver.session({
            defaultAccessMode: accessMode,
            bookmarks: bookmarks
          })
          this._id++
          this._sessions[this._id] = session
          this._writeResponse('Session', { id: this._id })
        }
        break

      case 'SessionClose':
        {
          const { sessionId } = data
          const session = this._sessions[sessionId]
          // TODO: Error handling
          // TODO: Remove from map
          session.close().then(() => {
            this._writeResponse('Session', { id: sessionId })
          })
        }
        break

      case 'SessionRun':
        {
          const { sessionId, cypher, params } = data
          const session = this._sessions[sessionId]
          if (params) {
            for (const [key, value] of Object.entries(params)) {
              params[key] = cypherToNative(value)
            }
          }
          const result = session.run(cypher, params)
          this._id++
          const resultObserver = new ResultObserver()
          result.subscribe(resultObserver)
          this._resultObservers[this._id] = resultObserver
          this._writeResponse('Result', {
            id: this._id
          })
        }
        break

      case 'ResultNext':
        {
          const { resultId } = data
          const resultObserver = this._resultObservers[resultId]
          const nextPromise = resultObserver.next()
          nextPromise
            .then(rec => {
              if (rec) {
                const values = Array.from(rec.values()).map(nativeToCypher)
                this._writeResponse('Record', {
                  values: values
                })
              } else {
                this._writeResponse('NullRecord', null)
              }
            })
            .catch(e => {
              console.log('got some err: ' + JSON.stringify(e))
              this._writeError(e)
            })
        }
        break
      case 'SessionReadTransaction':
        {
          const { sessionId } = data
          const session = this._sessions[sessionId]
          session
            .readTransaction(
              tx =>
                new Promise((resolve, reject) => {
                  const txId = this._id++
                  this._txs[txId] = {
                    sessionId,
                    tx,
                    resolve,
                    reject,
                    txId
                  }
                  this._writeResponse('RetryableTry', { id: txId })
                })
            )
            .then(_ => this._writeResponse('RetryableDone', null))
            .catch(error => this._writeError(error))
        }
        break
      case 'TransactionRun':
        {
          const { txId, cypher, params } = data
          const tx = this._txs[txId]
          if (params) {
            for (const [key, value] of Object.entries(params)) {
              params[key] = cypherToNative(value)
            }
          }
          const result = tx.tx.run(cypher, params)
          this._id++
          const resultObserver = new ResultObserver()
          result.subscribe(resultObserver)
          this._resultObservers[this._id] = resultObserver
          this._writeResponse('Result', {
            id: this._id
          })
        }
        break
      case 'RetryablePositive':
        {
          const { sessionId } = data
          const tx = Object.values(this._txs).filter(
            ({ sessionId: id }) => sessionId === id
          )[0]
          delete this._txs[tx.txId]
          tx.resolve()
        }
        break
      case 'RetryableNegative':
        {
          const { sessionId, errorId } = data
          const tx = Object.values(this._txs).filter(
            ({ sessionId: id }) => sessionId === id
          )[0]
          const error = this._errors[errorId] || new Error('Client error')
          delete this._txs[tx.txId]
          tx.reject(error)
        }
        break
      default:
        this._writeBackendError('Unknown request: ' + name)
        console.log('Unknown request: ' + name)
        console.log(JSON.stringify(data))
    }
  }

  _writeResponse (name, data) {
    console.log('> writing response', name, data)
    let response = {
      name: name,
      data: data
    }
    response = JSON.stringify(response)
    const lines = ['#response begin', response, '#response end']
    this._writer(lines)
  }

  _writeBackendError (msg) {
    this._writeResponse('BackendError', { msg: msg })
  }

  _writeError (e) {
    if (e.name) {
      this._id++
      this._errors[this._id] = e
      this._writeResponse('DriverError', {
        id: this._id,
        msg: e.message + ' (' + e.code + ')'
      })
      return
    }
    this._writeBackendError(e)
  }
}

function server () {
  const server = net.createServer(conn => {
    const backend = new Backend({
      writer: lines => {
        const chunk = lines.join('\n') + '\n'
        conn.write(chunk, 'utf8', () => {})
      }
    })
    conn.setEncoding('utf8')
    const iface = readline.createInterface(conn, null)
    iface.on('line', backend.onLine)
  })
  server.listen(9876, () => {
    console.log('Listening')
  })
}
server()
