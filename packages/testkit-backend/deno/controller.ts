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
          return reply(writeDriverError(id, e));
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

function writeDriverError(id, e) {
  console.log("writing DriverError");
  console.log(e);
  console.log("Cause: ", e.cause);
  const cause = (e.cause != null && e.cause != undefined)
    ? writeGqlError(e.cause)
    : undefined;
  return {
    name: "DriverError",
    id,
    errorType: e.name,
    msg: e.message,
    code: e.code,
    gqlStatus: e.gqlStatus,
    statusDescription: e.gqlStatusDescription,
    diagnosticRecord: e.diagnosticRecord,
    cause: cause,
    classification: e.classification,
    rawClassification: e.rawClassification,
    retryable: e.retriable,
  };
}

function writeGqlError(e) {
  console.log("writing GqlError");
  console.log(e);
  console.log("Cause: ", e.cause);
  const cause = (e.cause != null && e.cause != undefined)
    ? writeGqlError(e.cause)
    : undefined;
  return {
    name: "GqlError",
    msg: e.message,
    gqlStatus: e.gqlStatus,
    statusDescription: e.gqlStatusDescription,
    diagnosticRecord: e.diagnosticRecord,
    cause: cause,
    classification: e.classification,
    rawClassification: e.rawClassification,
  };
}

export default {
  createHandler,
};
