import Backend from './backend'
import { SocketChannel, WebSocketChannel } from './channel'
import { LocalController, RemoteController } from './controller'
import { getShouldRunTest } from './skipped-tests'
import * as REQUEST_HANDLERS from './request-handlers'

/**
 * Responsible for configure and run the backend server.
 */
function main( ) {
  const testEnviroment = process.env.TEST_ENVIRONMENT || 'LOCAL'
  const channelType = process.env.CHANNEL_TYPE || 'SOCKET'
  const backendPort = process.env.BACKEND_PORT || 9876
  const webserverPort = process.env.WEB_SERVER_PORT || 8000
  const driverDescriptor = process.env.DRIVER_DESCRIPTOR || ''
  const driverDescriptorList = driverDescriptor
    .split(',').map(s => s.trim().toLowerCase())
    
  const shouldRunTest = getShouldRunTest(driverDescriptorList)

  const newChannel = () => {
    if ( channelType.toUpperCase() === 'WEBSOCKET' ) {
      return new WebSocketChannel(new URL(`ws://localhost:${backendPort}`))

    }
    return new SocketChannel(backendPort)
  } 

  const newController = () => {
    if ( testEnviroment.toUpperCase() === 'REMOTE' ) {
      return new RemoteController(webserverPort)
    }
    return new LocalController(REQUEST_HANDLERS, shouldRunTest)
  }

  const backend = new Backend(newController, newChannel)
    
  backend.start()

  if (process.on) {
    // cleaning up
    process.on('exit', backend.stop.bind(backend));

    // Capturing signals
    process.on('SIGINT', process.exit.bind(process));
    process.on('SIGUSR1', process.exit.bind(process));
    process.on('SIGUSR2', process.exit.bind(process));
    process.on('uncaughtException', exception => {
      console.error('UncaughtException', exception)
      process.exit()
    });
  }
}

main()
