/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface NameConvention {
  tokenize: (name: string) => string[]
  encode: (tokens: string[]) => string
}

export enum StandardCase {
  SnakeCase = 'snake_case',
  KebabCase = 'kebab-case',
  ScreamingSnakeCase = 'SCREAMING_SNAKE_CASE',
  PascalCase = 'PascalCase',
  CamelCase = 'camelCase'
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
  SCREAMING_SNAKE_CASE: {
    tokenize: (name: string) => name.split('_').map((token) => token.toLowerCase()),
    encode: (tokens: string[]) => tokens.join('_').toUpperCase()
  }
}
