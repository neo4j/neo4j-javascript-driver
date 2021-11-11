import Backend from './backend'
import { SocketChannel } from './channel'
import { LocalController } from './controller'
import * as request_handlers from './request-handlers'

function main( ) {
  const newChannel = () => new SocketChannel(process.env.BACKEND_PORT || 9876)
  const newController = () => new LocalController(request_handlers)
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
