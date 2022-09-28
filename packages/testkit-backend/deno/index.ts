import {
  handlers,
  getShouldRunTest,
  createGetFeatures,
  Context,
  neo4j
} from "./deps.ts"
import channel from "./channel.ts";
import controller from "./controller.ts";
import { RequestHandlerMap } from "./domain.ts";

const requestHandlers: RequestHandlerMap = handlers as RequestHandlerMap;

addEventListener("events.errorMonitor", (event) => {
  console.log("something here ========================", event);
});

addEventListener("unhandledrejection", (event) => {
  console.log("unhandledrejection", event)
  console.error("unhandledrejection", event)
})

const descriptor = ["async", "deno"];
const shouldRunTest = getShouldRunTest(descriptor);
const getFeatures = createGetFeatures(descriptor);
const createContext = () => new Context(shouldRunTest, getFeatures);

const listener = channel.listen(9876);
const handle = controller.createHandler(neo4j, createContext, requestHandlers);

for await (const client of listener) {
  handle(client.reply, client.requests);
}
