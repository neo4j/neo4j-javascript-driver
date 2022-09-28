import { TestkitRequest, TestkitResponse } from "./domain.ts";
import { iterateReader } from "./deps.ts";
export interface TestkitClient {
  id: number;
  requests: () => AsyncIterable<TestkitRequest>;
  reply: (response: TestkitResponse) => Promise<void>;
}

export async function* listen(port: number): AsyncIterable<TestkitClient> {
  let clientId = 0;
  const listener = Deno.listen({ port });

  for await (const conn of listener) {
    const id = clientId++;
    const requests = () => readRequests(conn);
    const reply = createReply(conn);
    yield { id, requests, reply };
  }
}

async function* readRequests(conn: Deno.Conn): AsyncIterable<TestkitRequest> {
  let inRequest = false;
  let requestString = "";
  for await (const message of iterateReader(conn)) {
    const rawTxtMessage = new TextDecoder().decode(message);
    const lines = rawTxtMessage.split("\n");
    for (const line of lines) {
      switch (line) {
        case "#request begin":
          if (inRequest) {
            throw new Error("Already in request");
          }
          inRequest = true;
          break;
        case "#request end":
          if (!inRequest) {
            throw new Error("Not in request");
          }
          yield JSON.parse(requestString);
          inRequest = false;
          requestString = "";
          break;
        case "":
          // ignore empty lines
          break;
        default:
          if (!inRequest) {
            throw new Error("Not in request");
          }
          requestString += line;
          break;
      }
    }
  }
}

function createReply(conn: Deno.Conn) {
  return async function (response: TestkitResponse): Promise<void> {
    const responseStr = JSON.stringify(
      response,
      (_, value) => typeof value === "bigint" ? `${value}n` : value,
    );

    const responseArr =
      ["#response begin", responseStr, "#response end"].join("\n") + "\n";
    const buffer = new Uint8Array(responseArr.length);
    new TextEncoder().encodeInto(responseArr, buffer);

    async function writeBuffer(buff: Uint8Array, size: number) {
      try {
        let bytesWritten = 0;
        while (bytesWritten < size) {
          const writtenInSep = await conn.write(buff.slice(bytesWritten));
          bytesWritten += writtenInSep;
        }
      } catch (error) {
        console.error(error);
      }
    }
    await writeBuffer(buffer, buffer.byteLength);
  };
}

export default {
  listen,
};
