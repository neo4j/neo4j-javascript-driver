import Context from "../src/context.js";
import CypherNativeBinders from "../src/cypher-native-binders.js";
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

function newWire(
  context: Context,
  binder: CypherNativeBinders,
  reply: Reply,
): Wire {
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
          return reply(writeDriverError(id, e, binder));
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
  const binder = new CypherNativeBinders(neo4j);
  return async function (
    reply: Reply,
    requests: () => AsyncIterable<TestkitRequest>,
  ) {
    const context = newContext();
    const wire = newWire(context, binder, (response) => {
      console.log("response:", response.name);
      console.debug(response.data);
      return reply(response);
    });

    for await (const request of requests()) {
      console.log("request:", request.name);
      console.debug(request.data);
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

function writeDriverError(id, e, binder) {
  const cause = (e.cause != null && e.cause != undefined)
    ? writeGqlError(e.cause, binder)
    : undefined;
  return {
    name: "DriverError",
    data: {
      id,
      errorType: e.name,
      msg: e.message,
      code: e.code,
      gqlStatus: e.gqlStatus,
      statusDescription: e.gqlStatusDescription,
      diagnosticRecord: binder.objectToCypher(e.diagnosticRecord),
      cause: cause,
      classification: e.classification,
      rawClassification: e.rawClassification,
      retryable: e.retriable,
    },
  };
}

function writeGqlError(e, binder) {
  const cause = (e.cause != null && e.cause != undefined)
    ? writeGqlError(e.cause, binder)
    : undefined;
  return {
    name: "GqlError",
    data: {
      msg: e.message,
      gqlStatus: e.gqlStatus,
      statusDescription: e.gqlStatusDescription,
      diagnosticRecord: binder.objectToCypher(e.diagnosticRecord),
      cause: cause,
      classification: e.classification,
      rawClassification: e.rawClassification,
    },
  };
}

export default {
  createHandler,
};
