import Context from "../src/context.js";
import { FakeTime } from "./deps.ts";
import {
  RequestHandlerMap,
  TestkitRequest,
  TestkitResponse,
} from "./domain.ts";

interface Reply {
  (response: TestkitResponse): Promise<void>;
}

interface Wire {
  writeResponse(response: TestkitRequest): Promise<void>;
  writeError(e: Error): Promise<void>;
  writeBackendError(msg: string): Promise<void>;
}

function newWire(context: Context, reply: Reply): Wire {
  return {
    writeResponse: (response: TestkitResponse) => reply(response),
    writeError: (e: Error) => {
      if (e.name) {
        if (e.message === "TestKit FrontendError") {
          return reply({
            name: "FrontendError",
            data: {
              msg: "Simulating the client code throwing some error.",
            },
          });
        } else {
          const id = context.addError(e);
          return reply({
            name: "DriverError",
            data: {
              id,
              msg: e.message,
              // @ts-ignore Code Neo4jError does have code
              code: e.code,
            },
          });
        }
      }
      const msg = e.message;
      return reply({ name: "BackendError", data: { msg } });
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
    const wire = newWire(context, (response) => {
      console.log("response:", response);
      return reply(response);
    });

    for await (const request of requests()) {
      console.log("request:", request);
      const { data, name } = request;
      if (!(name in requestHandlers)) {
        console.log("Unknown request: " + name);
        wire.writeBackendError("Unknown request: " + name);
      }

      const handleRequest = requestHandlers[name];

      handleRequest({ neo4j, mock: { FakeTime } }, context, data, wire);
    }
  };
}

export default {
  createHandler,
};
