const originalConsole = console

const config = {
  level: 'info',
  canRun: (method) => {
    if (config.level === 'debug') {
      return true
    } else if (config.level === 'info') {
      return method !== 'debug'
    } else if (config.level === 'warn') {
      return method !== 'debug' &&
               method !== 'log'
    } else if (config.level === 'error') {
      return method !== 'debug' &&
                method !== 'log' &&
                method !== 'warn'
    }
    return true
  }
}

export default {
  install (level = 'info') {
    this.setLevel(level)
    // eslint-disable-next-line no-global-assign
    console = new Proxy({}, {
      get: (_, method) => (...args) => {
        if (config.canRun(method)) {
          originalConsole[method].apply(originalConsole, args)
        }
      }
    })
  },
  setLevel (level) {
    config.level = (level || 'info').toLowerCase()
  },
  uninstall () {
    config.level = 'info'
    // eslint-disable-next-line no-global-assign
    console = originalConsole
  }
}
