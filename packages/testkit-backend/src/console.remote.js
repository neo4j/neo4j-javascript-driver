import { response } from './responses'

const originalConsole = console

export default {
  install: (channel) => {
    // eslint-disable-next-line no-global-assign
    console = new Proxy({}, {
      get: (_, method) => (...args) => {
        originalConsole[method].apply(originalConsole, args)
        channel.writeResponse(null, response('Console', {
          method,
          args
        }), true)
      }
    })
  },
  handleConsole: (message) => {
    if (message.response.name === 'Console') {
      const { method, args } = message.response.data
      args[0] = typeof args[0] === 'string' ? `[RemoteConsole] ${args[0]}` : args[0]
      console[method].apply(console, args)
      return true
    }
    return false
  },
  uninstall: () => {
    // eslint-disable-next-line no-global-assign
    console = originalConsole
  }
}
