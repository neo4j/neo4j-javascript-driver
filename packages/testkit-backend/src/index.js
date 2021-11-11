import Backend from './backend'
import { SocketChannel } from './channel'
import { LocalController, RemoteController } from './controller'
import * as REQUEST_HANDLERS from './request-handlers'

function main( ) {
  const testEnviroment = process.env.TEST_ENVIRONMENT || 'BROWSER'
  const backendPort = process.env.BACKEND_PORT || 9876
  const webserverPort = process.env.WEB_SERVER_PORT || 8000

  const newChannel = () => new SocketChannel(backendPort)

  const newController = () => {
    if ( testEnviroment.toUpperCase() === 'BROWSER' ) {
      return new RemoteController(webserverPort)
    }
    return new LocalController(REQUEST_HANDLERS)
  }

  const backend = new Backend(newController, newChannel)
    
  backend.start()

  // cleaning up
  process.on('exit', backend.stop.bind(backend));

  // Capturing signals
  process.on('SIGINT', process.exit.bind(process));
  process.on('SIGUSR1', process.exit.bind(process));
  process.on('SIGUSR2', process.exit.bind(process));
  process.on('uncaughtException', process.exit.bind(process));
}

main()
