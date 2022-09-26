import Backend from './backend'
import tls from 'tls'
import neo4j from './neo4j.js'
import { SocketChannel, WebSocketChannel } from './channel'
import { LocalController, RemoteController } from './controller'
import { getShouldRunTest } from './skipped-tests'
import { createGetFeatures } from './feature'
import * as REQUEST_HANDLERS from './request-handlers.js'
import * as RX_REQUEST_HANDLERS from './request-handlers-rx.js'

const SUPPORTED_TLS = (() => {
  if (tls.DEFAULT_MAX_VERSION) {
    const min = Number(tls.DEFAULT_MIN_VERSION.split('TLSv')[1])
    const max = Number(tls.DEFAULT_MAX_VERSION.split('TLSv')[1])
    const result = []
    for (let version = min > 1 ? min : 1.1; version <= max; version = Number((version + 0.1).toFixed(1))) {
      result.push(`Feature:TLS:${version.toFixed(1)}`)
    }
    return result
  }
  return []
})()

/**
 * Responsible for configure and run the backend server.
 */
function main () {
  const testEnviroment = process.env.TEST_ENVIRONMENT || 'LOCAL'
  const channelType = process.env.CHANNEL_TYPE || 'SOCKET'
  const backendPort = process.env.BACKEND_PORT || 9876
  const webserverPort = process.env.WEB_SERVER_PORT || 8000
  const driverDescriptor = process.env.DRIVER_DESCRIPTOR || ''
  const sessionType = process.env.SESSION_TYPE || 'ASYNC'
  const sessionTypeDescriptor = sessionType === 'RX' ? 'rx' : 'async'
  const driverDescriptorList = driverDescriptor
    .split(',').map(s => s.trim().toLowerCase())

  const shouldRunTest = getShouldRunTest([...driverDescriptorList, sessionTypeDescriptor])
  const getFeatures = createGetFeatures([sessionTypeDescriptor], SUPPORTED_TLS)

  const newChannel = () => {
    if (channelType.toUpperCase() === 'WEBSOCKET') {
      return new WebSocketChannel(new URL(`ws://localhost:${backendPort}`))
    }
    return new SocketChannel(backendPort)
  }

  const newController = () => {
    if (testEnviroment.toUpperCase() === 'REMOTE') {
      return new RemoteController(webserverPort)
    }
    return new LocalController(getRequestHandlers(sessionType), shouldRunTest, getFeatures, neo4j)
  }

  const backend = new Backend(newController, newChannel)

  backend.start()

  if (process.on) {
    // cleaning up
    process.on('exit', backend.stop.bind(backend))

    // Capturing signals
    process.on('SIGINT', process.exit.bind(process))
    process.on('SIGUSR1', process.exit.bind(process))
    process.on('SIGUSR2', process.exit.bind(process))
    process.on('uncaughtException', exception => {
      console.error('UncaughtException', exception)
      process.exit()
    })
  }
}

function getRequestHandlers (sessionType) {
  if (sessionType.toUpperCase() === 'RX') {
    return RX_REQUEST_HANDLERS
  }
  return REQUEST_HANDLERS
}

main()
