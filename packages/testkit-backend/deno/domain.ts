// deno-lint-ignore-file no-explicit-any
import Context from "../src/context.js";
import { FakeTime } from "./deps.ts";

export interface TestkitRequest {
  name: string;
  data?: any;
}

export interface TestkitResponse {
  name: string;
  data?: any;
}

export interface Mock {
  FakeTime: typeof FakeTime;
}

export interface RequestHandler {
  (service: { neo4j: any; mock: Mock }, c: Context, data: any, wire: any): void;
}

export interface RequestHandlerMap {
  [key: string]: RequestHandler;
}
