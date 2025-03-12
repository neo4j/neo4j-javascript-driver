export interface NameConvention {
  tokenize: (name: string) => string[]
  encode: (tokens: string[]) => string
}

export const nameConventions = {
  snake_case: {
    tokenize: (name: string) => name.split('_'),
    encode: (tokens: string[]) => tokens.join('_')
  },
  'kebab-case': {
    tokenize: (name: string) => name.split('-'),
    encode: (tokens: string[]) => tokens.join('-')
  },
  PascalCase: {
    tokenize: (name: string) => name.split(/(?=[A-Z])/).map((token) => token.toLowerCase()),
    encode: (tokens: string[]) => {
      let name: string = ''
      for (let token of tokens) {
        token = token.charAt(0).toUpperCase() + token.slice(1)
        name += token
      }
      return name
    }
  },
  camelCase: {
    tokenize: (name: string) => name.split(/(?=[A-Z])/).map((token) => token.toLowerCase()),
    encode: (tokens: string[]) => {
      let name: string = ''
      for (let [i, token] of tokens.entries()) {
        if (i !== 0) {
          token = token.charAt(0).toUpperCase() + token.slice(1)
        }
        name += token
      }
      return name
    }
  },
  SNAKE_CAPS: {
    tokenize: (name: string) => name.split('_').map((token) => token.toLowerCase()),
    encode: (tokens: string[]) => tokens.join('_').toUpperCase()
  }
}
