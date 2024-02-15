import {
  Context,
  createGetFeatures,
  CypherNativeBinders,
  getShouldRunTest,
  handlers,
  neo4j,
} from "./deps.ts";
import channel from "./channel.ts";
import controller from "./controller.ts";
import { RequestHandlerMap } from "./domain.ts";

const requestHandlers: RequestHandlerMap = handlers as RequestHandlerMap;

addEventListener("events.errorMonitor", (event) => {
  console.log("something here ========================", event);
});

addEventListener("unhandledrejection", (event: Event) => {
  // @ts-ignore PromiseRejectionEvent has reason property
  console.error("unhandledrejection", event.reason);
});

const binder = new CypherNativeBinders(neo4j);
const descriptor = ["async", "deno"];
const shouldRunTest = getShouldRunTest(descriptor);
const getFeatures = createGetFeatures(descriptor);
const logLevel = Deno.env.get("TEST_LOG_LEVEL");
const createContext = () =>
  new Context(shouldRunTest, getFeatures, binder, logLevel);

const listener = channel.listen(9876);
const handle = controller.createHandler(neo4j, createContext, requestHandlers);

for await (const client of listener) {
  handle(client.reply, client.requests);
}
