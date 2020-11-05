import neo4j from 'neo4j-driver'
import net from 'net'
import readline from 'readline'
import Context from './context.js'
import ResultObserver from './result-observer.js'
import { nativeToCypher, cypherToNative } from './cypher-native-binders.js'

class Backend {
  constructor ({ writer }) {
    console.log('Backend connected')
    this._inRequest = false
    this._request = ''
    // Event handlers need to be bound to this instance
    this.onLine = this.onLine.bind(this)
    this._writer = writer
    this._context = new Context()
  }

  // Called whenever a new line is received.
  onLine (line) {
    switch (line) {
      case '#request begin':
        if (this._inRequest) {
          throw new Error('Already in request')
        }
        this._inRequest = true
        break
      case '#request end':
        if (!this._inRequest) {
          throw new Error('End while not in request')
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
          throw new Error('Line while not in request')
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
            authorizationToken: { data: authToken },
            userAgent
          } = data
          const driver = neo4j.driver(uri, authToken, { userAgent })
          const id = this._context.addDriver(driver)
          this._writeResponse('Driver', { id })
        }
        break

      case 'DriverClose':
        {
          const { driverId } = data
          const driver = this._context.getDriver(driverId)
          driver
            .close()
            .then(() => {
              this._writeResponse('Driver', { id: driverId })
            })
            .catch(err => this._writeError(err))
          this._context.removeDriver(driverId)
        }
        break

      case 'NewSession':
        {
          let { driverId, accessMode, bookmarks, database } = data
          switch (accessMode) {
            case 'r':
              accessMode = neo4j.session.READ
              break
            case 'w':
              accessMode = neo4j.session.WRITE
              break
            default:
              this._writeBackendError('Unknown accessmode: ' + accessMode)
              return
          }
          const driver = this._context.getDriver(driverId)
          const session = driver.session({
            defaultAccessMode: accessMode,
            bookmarks,
            database
          })
          const id = this._context.addSession(session)
          this._writeResponse('Session', { id })
        }
        break

      case 'SessionClose':
        {
          const { sessionId } = data
          const session = this._context.getSession(sessionId)
          session
            .close()
            .then(() => {
              this._writeResponse('Session', { id: sessionId })
            })
            .catch(err => this._writeError(err))
          this._context.removeSession(sessionId)
        }
        break

      case 'SessionRun':
        {
          const { sessionId, cypher, params } = data
          const session = this._context.getSession(sessionId)
          if (params) {
            for (const [key, value] of Object.entries(params)) {
              params[key] = cypherToNative(value)
            }
          }

          const observers = this._context.getResultObserversBySessionId(
            sessionId
          )

          Promise.all(observers.map(obs => obs.completitionPromise()))
            .catch(_ => null)
            .then(_ => {
              const result = session.run(cypher, params)
              const resultObserver = new ResultObserver({ sessionId })
              result.subscribe(resultObserver)
              const id = this._context.addResultObserver(resultObserver)
              this._writeResponse('Result', { id })
            })
        }
        break

      case 'ResultNext':
        {
          const { resultId } = data
          const resultObserver = this._context.getResultObserver(resultId)
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
          const session = this._context.getSession(sessionId)
          session
            .readTransaction(
              tx =>
                new Promise((resolve, reject) => {
                  const id = this._context.addTx(tx, sessionId, resolve, reject)
                  this._writeResponse('RetryableTry', { id })
                })
            )
            .then(_ => this._writeResponse('RetryableDone', null))
            .catch(error => this._writeError(error))
        }
        break

      case 'TransactionRun':
        {
          const { txId, cypher, params } = data
          const tx = this._context.getTx(txId)
          if (params) {
            for (const [key, value] of Object.entries(params)) {
              params[key] = cypherToNative(value)
            }
          }
          const result = tx.tx.run(cypher, params)
          const resultObserver = new ResultObserver({})
          result.subscribe(resultObserver)
          const id = this._context.addResultObserver(resultObserver)
          this._writeResponse('Result', { id })
        }
        break

      case 'RetryablePositive':
        {
          const { sessionId } = data
          this._context.getTxsBySessionId(sessionId).forEach(tx => {
            tx.resolve()
            this._context.removeTx(tx.id)
          })
        }
        break

      case 'RetryableNegative':
        {
          const { sessionId, errorId } = data
          const error =
            this._context.getError(errorId) || new Error('Client error')
          this._context.getTxsBySessionId(sessionId).forEach(tx => {
            tx.reject(error)
            this._context.removeTx(tx.id)
          })
        }
        break

      case 'SessionBeginTransaction':
        {
          const { sessionId, txMeta: metadata, timeout } = data
          const session = this._context.getSession(sessionId)
          const tx = session.beginTransaction({ metadata, timeout })
          const id = this._context.addTx(tx, sessionId)
          this._writeResponse('Transaction', { id })
        }
        break

      case 'TransactionCommit':
        {
          const { txId: id } = data
          const { tx } = this._context.getTx(id)
          tx.commit()
            .then(() => this._writeResponse('Transaction', { id }))
            .catch(e => {
              console.log('got some err: ' + JSON.stringify(e))
              this._writeError(e)
            })
          this._context.removeTx(id)
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
      const id = this._context.addError(e)
      this._writeResponse('DriverError', {
        id,
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
