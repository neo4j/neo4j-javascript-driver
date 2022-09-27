import Context from '../src/context.js';
import { getShouldRunTest } from '../src/skipped-tests/index.js';
import neo4j from '../../neo4j-driver-deno/lib/mod.ts'
import { createGetFeatures } from '../src/feature/index.js';
import * as handlers from '../src/request-handlers.js';

const listener = Deno.listen({ port: 9876 });
let index = 0;
const contexts = new Map<number, Context>();

interface RequestHandler {
  (c: Context, data: any, wire: any): void
}

interface RequestHandlerMap {
  [key: string]: RequestHandler
}

addEventListener('uncaughtException', (event) => {
  console.log('unhandled rejection', event);
})

// @ts-ignore
const requestHandlers: RequestHandlerMap = handlers as RequestHandlerMap

addEventListener('events.errorMonitor', (event) => {
  console.log('something here ========================')
})

interface Backend {
  openContext(contextId: number): void 
  closeContext(contextId: number): void
  handle(contextId: number, conn: Deno.Conn, request: { name: string, data: object }): void
}

function write(conn: Deno.Conn, response: object) {
  const responseStr = JSON.stringify(response, (_, value) =>
    typeof value === 'bigint' ? `${value}n` : value
  )
  const responseArr = ['#response begin', responseStr, '#response end'].join('\n') + '\n'
  console.log('response', responseArr);
  const buffer = new Uint8Array(responseArr.length);
  new TextEncoder().encodeInto(responseArr, buffer);
  
  async function writeBuffer(buff: Uint8Array, size: number) {
    let bytesWritten = 0;
    while(bytesWritten < size) {
      const writtenInSep = await conn.write(buff.slice(bytesWritten));
      bytesWritten += writtenInSep;
    }
  }

  writeBuffer(buffer, buffer.byteLength);
  
}

const descriptor = ['async', 'deno'] as string[]
const shouldRunTest = getShouldRunTest(descriptor);
const getFeatures = createGetFeatures(descriptor);

const backend: Backend = {
  openContext: (contextId) => {
    console.log("Open context:", contextId);
    contexts.set(contextId, new Context(shouldRunTest, getFeatures));
  },
  closeContext: (contextId) => {
    console.log('Close context', contextId);
    contexts.delete(contextId);
  },
  handle: (contextId, conn, req) => {
    const { data, name } = req;
    if (!contexts.has(contextId)) {
      throw new Error(`Context ${contextId} does not exist`)
    } else if (!(name in requestHandlers)) {
      console.log('Unknown request: ' + name)
      throw new Error(`Unknown request: ${name}`)
    }

    console.log('Handle', req.name, req.data);
    
    const handler: (neo4j: any, c: Context, data: any, wire: any) => void = requestHandlers[name as string];

    handler(neo4j, contexts.get(contextId)!!, data, {
      writeResponse: (response: object) => write(conn, response),
      writeError: (e: Error) => {
        console.error(e)
        if (e.name) {
          if (e.message === 'TestKit FrontendError') {
            write(conn, { name: 'FrontendError', data: {
              msg: 'Simulating the client code throwing some error.'
            }})
          } else {
            const id = contexts.get(contextId)?.addError(e)
            write(conn, { name: 'DriverError', data: {
              id,
              msg: e.message,
              // @ts-ignore
              code: e.code 
            }})
          }
          return
        }
        const msg = e.message
        write(conn, { name: 'BackendError', data: { msg } })
      },
      writeBackendError: (msg: string) => write(conn, { name: 'BackendError', data: { msg } })
    });
  }
}

for await (const conn of listener) {
  const contextId = index++;
  handleConnection(conn, contextId)
}

async function handleConnection( conn: Deno.Conn, contextId: number): Promise<void> {
  backend.openContext(contextId);
  let inRequest = false
  let requestString = ''
  try {
    for await (const message of Deno.iter(conn)) {
      const rawTxtMessage = new TextDecoder().decode(message);
      const lines = rawTxtMessage.split('\n');
      for (const line of lines) {
        switch (line) {
          case '#request begin':
            if(inRequest) {
              throw new Error('Already in request');
            }
            inRequest = true;
            break;
          case '#request end':
            if(!inRequest) {
              throw new Error('Not in request');
            }
            const request = JSON.parse(requestString);
            backend.handle(contextId, conn, request);
            inRequest = false;
            requestString = '';
            break
          case '':
            // ignore empty lines
            break;
          default:
            if(!inRequest) {
              throw new Error('Not in request');
            }
            requestString += line;
            break
        }
      }
    }
  } catch (err) {
    console.error(err)
  }
  
  backend.closeContext(contextId);
}
