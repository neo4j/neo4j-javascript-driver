import Context from '../src/context.js';
import { getShouldRunTest } from '../src/skipped-tests/index.js';
import neo4j from '../../neo4j-driver-deno/lib/mod.ts'
import { createGetFeatures } from '../src/feature/index.js';
import * as handlers from '../src/request-handlers.js';
import channel from './channel.ts';
import controller from './controller.ts';

// @ts-ignore
const requestHandlers: RequestHandlerMap = handlers as RequestHandlerMap

addEventListener('events.errorMonitor', (event) => {
  console.log('something here ========================', event)
})

const descriptor = ['async', 'deno']
const shouldRunTest = getShouldRunTest(descriptor);
const getFeatures = createGetFeatures(descriptor);
const createContext = () => new Context(shouldRunTest, getFeatures)

const listener = channel.listen(9876)
const handle = controller.createHandler(neo4j, createContext, requestHandlers)

for await (const client of listener) {
  handle(client.reply, client.requests)
}
