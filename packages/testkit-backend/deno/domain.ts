import Context from '../src/context.js';

export interface  TestkitRequest {
  name: string,
  data?: any
}

export interface TestkitResponse {
  name: string,
  data?: any
}

export interface RequestHandler {
  (neo4j: any, c: Context, data: any, wire: any): void
}

export interface RequestHandlerMap {
  [key: string]: RequestHandler
}
