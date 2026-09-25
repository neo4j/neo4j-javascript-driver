import { TextEncoder } from 'util'
import crypto from 'crypto'

global.TextEncoder = TextEncoder
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
    getRandomValues: crypto.getRandomValues
  }
})
