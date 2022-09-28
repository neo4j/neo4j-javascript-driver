import Context from "../src/context.js";
import {
  RequestHandlerMap,
  TestkitRequest,
  TestkitResponse,
} from "./domain.ts";

interface Reply {
  (response: TestkitResponse): Promise<void>;
}

function newWire(context: Context, reply: Reply): any {
  return {
    writeResponse: (response: TestkitResponse) => reply(response),
    writeError: (e: Error) => {
      if (e.name) {
        if (e.message === "TestKit FrontendError") {
          reply({
            name: "FrontendError",
            data: {
              msg: "Simulating the client code throwing some error.",
            },
          });
        } else {
          const id = context.addError(e);
          reply({
            name: "DriverError",
            data: {
              id,
              msg: e.message,
              // @ts-ignore Code Neo4jError does have code
              code: e.code,
            },
          });
        }
        return;
      }
      const msg = e.message;
      reply({ name: "BackendError", data: { msg } });
    },
    writeBackendError: (msg: string) =>
      reply({ name: "BackendError", data: { msg } }),
  };
}

export function createHandler(
  // deno-lint-ignore no-explicit-any
  neo4j: any,
  newContext: () => Context,
  requestHandlers: RequestHandlerMap,
) {
  return async function (
    reply: Reply,
    requests: () => AsyncIterable<TestkitRequest>,
  ) {
    const context = newContext();
    const wire = newWire(context, response => {
      console.log('response:', response)
      return reply(response)
    });

    for await (const request of requests()) {
      console.log('request:', request)
      const { data, name } = request;
      if (!(name in requestHandlers)) {
        console.log("Unknown request: " + name);
        wire.writeBackendError("Unknown request: " + name);
      }

      const handleRequest = requestHandlers[name];

      handleRequest(neo4j, context, data, wire);
    }
  };
}

export default {
  createHandler,
};
