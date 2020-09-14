var neo4j = require('neo4j-driver')
var net = require('net')
var readline = require('readline')
const { nativeToCypher, cypherToNative } = require('./cypher-native-binders')
const { ResultObserver } = require('./result-observer')

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
