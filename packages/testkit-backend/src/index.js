import Backend from './backend'
import NodeController from './node.controller'

function main( ) {
  const backend = new Backend(process.env.BACKEND_PORT || 9876, () => new NodeController())
    
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