export type NameConvention = {
    tokenize: (name: string) => Array<string>
    encode: (tokens: Array<string>) => string
}

export const nameConventions = {
    "snake_case": {
        tokenize: (name: string) => name.split("_"),
        encode: (tokens: Array<string>) => tokens.join("_")
    },
    "kebab-case":  {
        tokenize: (name: string) => name.split("-"),
        encode: (tokens: Array<string>) => tokens.join("-")
    },
    "PascalCase": {
        tokenize: (name: string) => name.split(/(?=[A-Z])/).map((token) => token.toLowerCase()),
        encode: (tokens: Array<string>) => {
            let name:string = ""
            for (var token of tokens) {
                token = token.charAt(0).toUpperCase() + token.slice(1)
                name += token
            }
            return name
        }
    },
    "camelCase": {
        tokenize: (name: string) => name.split(/(?=[A-Z])/).map((token) => token.toLowerCase()),
        encode: (tokens: Array<string>) => {
            let name:string = ""
            for (var [i, token] of tokens.entries()) {
                if( i !== 0) {
                    token = token.charAt(0).toUpperCase() + token.slice(1)
                }
                name += token
            }
            return name
        }
    },
    "SNAKE_CAPS": {
        tokenize: (name: string) => name.split("_").map((token) => token.toLowerCase()),
        encode: (tokens: Array<string>) => tokens.join("_").toUpperCase()
    }
}
